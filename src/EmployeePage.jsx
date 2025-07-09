import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaUpload, FaEye } from 'react-icons/fa';
import './App.css';
import { supabase } from './supabaseClient';

function EmployeePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [siteList, setSiteList] = useState([]);
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);

  const fieldMapping = {
    id_card_copy: 'สำเนาบัตรประชาชน',
    house_registration: 'ทะเบียนบ้าน',
    transcript: 'Transcript',
    bank_account: 'บัญชีธนาคาร',
    photo: 'รูปถ่าย',
    personal_data_file: 'ไฟล์ข้อมูลส่วนบุคคล',
    employment_contract: 'สัญญาจ้าง',
  };

  const documentFields = Object.keys(fieldMapping).map((key) => ({
    key,
    label: fieldMapping[key],
  }));

  const booleanFields = [
    { key: 'contract_signed', label: 'เซ็นสัญญาแล้ว' },
    { key: 'personal_data_acknowledged', label: 'รับทราบพ.ร.บข้อมูล' },
    { key: 'social_security_registered', label: 'ลงทะเบียนประกันสังคม' }
  ];

  useEffect(() => {
    fetch('https://leave-tracker-production-8bcc.up.railway.app/api/document')
      .then((res) => res.json())
      .then((data) => setEmployees(data))
      .catch((err) => console.error('โหลดข้อมูลพนักงานล้มเหลว:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch('https://leave-tracker-production-8bcc.up.railway.app/api/sites')
      .then((res) => res.json())
      .then(setSiteList);

    fetch('https://leave-tracker-production-8bcc.up.railway.app/api/meta-options')
      .then((res) => res.json())
      .then((data) => {
        setPositions(data.positions);
        setDepartments(data.departments);
      });
  }, []);

  const handleFileChange = async (e, employeeId, docType) => {
    const file = e.target.files[0];
    if (!file) return;
    const fileExt = file.name.split('.').pop();
    const fileName = `${employeeId}/${docType}.${fileExt}`;
    const filePath = fileName;

    const { error } = await supabase.storage
      .from('document')
      .upload(filePath, file, { upsert: true });

    if (error) return alert('❌ อัปโหลดล้มเหลว: ' + error.message);

    const { data: urlData } = supabase.storage.from('document').getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    await fetch('https://leave-tracker-production-8bcc.up.railway.app/api/update-document-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id: employeeId,
        field: fieldMapping[docType],
        url: publicUrl,
      }),
    });
  };

  const handleToggleBooleanField = async (employeeId, field, currentValue) => {
    const res = await fetch('https://leave-tracker-production-8bcc.up.railway.app/api/update-boolean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: employeeId, field, value: !currentValue }),
    });
    if (res.ok) {
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.employee_id === employeeId ? { ...emp, [field]: { Bool: !currentValue, Valid: true } } : emp
        )
      );
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.employee_id.toString().includes(searchTerm) ||
    emp.employee_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container my-5">
      <h2 className="text-center text-primary fw-bold mb-4">📂 เอกสารพนักงาน</h2>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <input
          type="search"
          className="form-control form-control-lg shadow-sm"
          placeholder="🔍 ค้นหาด้วยรหัส หรือชื่อ"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ maxWidth: 350 }}
        />
      </div>
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <div className="mt-3 text-muted">กำลังโหลดข้อมูล...</div>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover table-bordered align-middle text-center shadow-sm rounded">
            <thead className="table-primary">
              <tr>
                <th>รหัส</th>
                <th>ชื่อ</th>
                <th>อีเมล</th>
                <th>อีเมลต้อนรับ</th>
                <th>ตอบกลับ</th>
                {booleanFields.map(({ label }) => <th key={label}>{label}</th>)}
                {documentFields.map(({ label }) => <th key={label}>{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-muted py-4">
                    <img src="https://cdn-icons-png.flaticon.com/512/4076/4076549.png" alt="empty" style={{width:80,opacity:0.5}} />
                    <div className="mt-3">ไม่พบข้อมูล</div>
                  </td>
                </tr>
              ) : filteredEmployees.map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.employee_id}</td>
                  <td>{emp.employee_name}</td>
                  <td>{emp.employee_email}</td>
                  <td>{emp.welcome_email_sent?.Bool ? '✅' : '⛔'}</td>
                  <td>{emp.employee_replied?.Bool ? '✅' : '⛔'}</td>
                  {booleanFields.map(({ key }) => (
                    <td
                      key={key}
                      style={{ cursor: 'pointer', color: emp[key]?.Bool ? 'green' : 'red' }}
                      onClick={() => handleToggleBooleanField(emp.employee_id, key, emp[key]?.Bool)}>
                      {emp[key]?.Bool ? '✅' : '⛔'}
                    </td>
                  ))}
                  {documentFields.map(({ key }) => (
                    <td key={key}>
                      <div className="d-flex flex-column align-items-center">
                        {emp[key]?.Valid && emp[key]?.String ? (
                          <a href={emp[key].String} target="_blank" rel="noreferrer">
                            <FaEye />
                          </a>
                        ) : <span className="text-muted">ไม่มี</span>}
                        <label className="icon-button upload-btn">
                          <FaUpload />
                          <input type="file" hidden onChange={(e) => handleFileChange(e, emp.employee_id, key)} />
                        </label>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default EmployeePage;
