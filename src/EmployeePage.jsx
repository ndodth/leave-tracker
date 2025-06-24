import React, { useEffect, useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaUpload, FaEye } from 'react-icons/fa';
import './App.css';
import { supabase } from './supabaseClient';
import emailjs from 'emailjs-com';
import { data } from 'react-router-dom';

function EmployeePage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [siteList, setSiteList] = useState([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');

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
      .then((data) => {
      console.log('ข้อมูลจาก API:', data);
      setEmployees(data);
    })
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

  const handleAddEmployee = async () => {
    if (!newName || !newEmail || !selectedSite || !selectedPosition || !selectedDepartment) {
      alert('กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    const res = await fetch('https://leave-tracker-production-8bcc.up.railway.app/api/add-employee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName,
        email: newEmail,
        site: selectedSite,
        position: selectedPosition,
        department: selectedDepartment,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      setEmployees([...employees, data]);
      setShowAddModal(false);

      emailjs.send('service_jkmc6sy', 'template_hoa2555', {
        to_name: newName,
        to_email: newEmail,
        confirm_link: `https://leave-tracker-production-8bcc.up.railway.app/api/employee-confirm/${data.employee_id}`,
      }, 'd-wSsdetLCRUMcgoO');

      setNewName('');
      setNewEmail('');
      setSelectedSite('');
    } else {
      alert('❌ เพิ่มพนักงานไม่สำเร็จ');
    }
  };

  return (
    <div className="container my-5">
      <h2 className="text-center text-primary fw-bold mb-4">📂 เอกสารพนักงาน</h2>
      <button className="btn btn-success mb-3" onClick={() => setShowAddModal(true)}>➕ เพิ่มพนักงาน</button>

      {loading ? <p>⏳ กำลังโหลด...</p> : (
        <div className="table-responsive">
          <table className="table table-bordered text-center">
            <thead>
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
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.employee_id}</td>
                  <td>{emp.employee_name}</td>
                  <td>{emp.email?.String || '-'}</td>
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

      {showAddModal && (
        <div className="modal d-block bg-dark bg-opacity-50">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">เพิ่มพนักงาน</h5>
                <button className="btn-close" onClick={() => setShowAddModal(false)}></button>
              </div>
              <div className="modal-body">
                <input className="form-control mb-2" placeholder="ชื่อ-นามสกุล" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <input className="form-control mb-2" placeholder="อีเมล" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                <select className="form-select mb-2" value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)}>
                  <option value="">-- เลือกไซต์ --</option>
                  {siteList.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
                </select>
                <select className="form-select mb-2" value={selectedPosition} onChange={(e) => setSelectedPosition(e.target.value)}>
                  <option value="">-- เลือกตำแหน่ง --</option>
                  {positions.map((p, i) => <option key={i} value={p}>{p}</option>)}
                </select>
                <select className="form-select mb-2" value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)}>
                  <option value="">-- เลือกแผนก --</option>
                  {departments.map((d, i) => <option key={i} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>ยกเลิก</button>
                <button className="btn btn-primary" onClick={handleAddEmployee}>บันทึก</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmployeePage;
