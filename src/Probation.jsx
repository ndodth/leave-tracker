import React, { useEffect, useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaCheckCircle, FaHourglassHalf, FaFileExcel } from 'react-icons/fa';
import * as XLSX from 'xlsx'; // เพิ่มบรรทัดนี้
import './App.css';

function ProbationPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [site, setSite] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sites, setSites] = useState([]);
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [evaluations, setEvaluations] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // โหลด options
  useEffect(() => {
    fetch('https://leave-tracker-production-8bcc.up.railway.app/api/sites')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setSites(data);
        else if (Array.isArray(data.sites)) setSites(data.sites);
        else setSites([]);
      });

    fetch('https://leave-tracker-production-8bcc.up.railway.app/api/meta-options')
      .then(res => res.json())
      .then(data => {
        setPositions(data.positions || []);
        setDepartments(data.departments || []);
      });
  }, []);

  // โหลดข้อมูลประเมิน
  useEffect(() => {
    fetch('https://leave-tracker-production-8bcc.up.railway.app/api/evaluations')
      .then(res => res.json())
      .then(data => setEvaluations(Array.isArray(data) ? data : []))
      .catch(err => console.error('โหลดข้อมูลผลการประเมินล้มเหลว:', err))
      .finally(() => setLoading(false));
  }, []);

  // ฟิลเตอร์ข้อมูล
  const filtered = evaluations.filter(e =>
    (e.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.evaluator_name?.toLowerCase().includes(search.toLowerCase()) ||
      (e.employee_id + '').includes(search))
  );

  // เพิ่มพนักงาน
  const handleAddEmployee = async () => {
    if (!name || !email || !site || !position || !department || !startDate || !endDate) {
      alert('กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    const res = await fetch('https://leave-tracker-production-8bcc.up.railway.app/api/add-employee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        site,
        position,
        department,
        start_date: startDate,
        end_date: endDate,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      setShowAddModal(false);
      setName('');
      setEmail('');
      setSite('');
      setPosition('');
      setDepartment('');
      setStartDate('');
      setEndDate('');
      // อัปเดตตารางประเมิน (ถ้าต้องการ)
      // fetch evaluations ใหม่ หรือ push data เข้า evaluations
    } else {
      alert('❌ เพิ่มพนักงานไม่สำเร็จ');
    }
  };

  // ฟังก์ชันสำหรับดาวน์โหลดข้อมูลที่แสดงอยู่เป็น Excel
  const handleDownloadExcel = () => {
    const exportData = filtered.map(e => ({
      'รหัสประเมิน': e.id,
      'รหัสทดลองงาน': e.probation_id,
      'รหัสพนักงาน': e.employee_id,
      'ชื่อพนักงาน': e.employee_name,
      'บทบาทผู้ประเมิน': e.role === 'manager' ? 'หัวหน้า' : e.role === 'hr' ? 'HR' : e.role,
      'รหัสผู้ประเมิน': e.evaluator_id,
      'ชื่อผู้ประเมิน': e.evaluator_name,
      'ความคิดเห็น': e.comment,
      'เวลาส่งประเมิน': e.evaluation_time ? new Date(e.evaluation_time).toLocaleString() : '',
      'สถานะ': e.comment ? 'เสร็จสิ้น' : 'รอดำเนินการ'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ผลการประเมิน');
    XLSX.writeFile(wb, 'probation_evaluations.xlsx');
  };

  return (
    <div className="container my-5">
      <header className="mb-4 text-center">
        <h1 className="display-5 fw-bold text-primary">ระบบประเมินทดลองงาน</h1>
        <p className="lead text-secondary">ติดตามและจัดการสถานะการประเมินพนักงานใหม่</p>
      </header>

      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
        <button className="btn btn-success mb-3" onClick={() => setShowAddModal(true)}>
          ➕ เพิ่มพนักงานทดลองงาน
        </button>
        <button className="btn btn-outline-success mb-3" onClick={handleDownloadExcel}>
          <FaFileExcel className="me-2" />
          ดาวน์โหลด Excel
        </button>
      </div>

      {/* ช่องค้นหา */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
        <h4 className="mb-0 text-primary">📋 ผลการประเมินทดลองงาน</h4>
        <input
          type="search"
          className="form-control form-control-lg shadow-sm"
          placeholder="🔍 ค้นหาด้วยรหัส ชื่อพนักงาน หรือชื่อผู้ประเมิน"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 350 }}
        />
      </div>

      {/* ตารางผลการประเมิน */}
      <div className="table-responsive">
        <table className="table table-bordered align-middle text-center shadow-sm rounded">
          <thead className="table-info">
            <tr>
              <th>รหัสประเมิน</th>
              <th>รหัสทดลองงาน</th>
              <th>รหัสพนักงาน</th>
              <th>ชื่อพนักงาน</th>
              <th>บทบาทผู้ประเมิน</th>
              <th>ความคิดเห็น</th>
              <th>เวลาส่งประเมิน</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="text-muted py-4">⏳ กำลังโหลด...</td>
              </tr>
            ) : filtered.length > 0 ? filtered.map(e => (
              <tr key={e.id}>
                <td>{e.id}</td>
                <td>{e.probation_id}</td>
                <td>{e.employee_id}</td>
                <td>{e.employee_name}</td>
                <td>{e.role === 'manager' ? 'หัวหน้า' : e.role === 'hr' ? 'HR' : e.role}</td>
                <td>{e.comment || <span className="text-muted">-</span>}</td>
                <td>{e.evaluation_time ? new Date(e.evaluation_time).toLocaleString() : '-'}</td>
                <td>
                  {e.status === 'Completed' ? (
                    <span className="text-success">
                      <FaCheckCircle className="me-1" /> เสร็จสิ้น
                    </span>
                  ) : (
                    <span className="text-danger">
                      <FaHourglassHalf className="me-1" /> รอดำเนินการ
                    </span>
                  )}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={10} className="text-muted py-4">ไม่พบข้อมูล</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal เพิ่มพนักงานทดลองงาน */}
      {showAddModal && (
        <div className="modal d-block bg-dark bg-opacity-50">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">เพิ่มพนักงานทดลองงาน</h5>
                <button className="btn-close" onClick={() => setShowAddModal(false)}></button>
              </div>
              <div className="modal-body">
                <input className="form-control mb-2" placeholder="ชื่อ-นามสกุล" value={name} onChange={(e) => setName(e.target.value)} />
                <input className="form-control mb-2" placeholder="อีเมล" value={email} onChange={(e) => setEmail(e.target.value)} />
                <select className="form-select mb-2" value={site} onChange={(e) => setSite(e.target.value)}>
                  <option value="">-- เลือกไซต์ --</option>
                  {sites.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
                </select>
                <select className="form-select mb-2" value={position} onChange={(e) => setPosition(e.target.value)}>
                  <option value="">-- เลือกตำแหน่ง --</option>
                  {positions.map((p, i) => <option key={i} value={p}>{p}</option>)}
                </select>
                <select className="form-select mb-2" value={department} onChange={(e) => setDepartment(e.target.value)}>
                  <option value="">-- เลือกแผนก --</option>
                  {departments.map((d, i) => <option key={i} value={d}>{d}</option>)}
                </select>
                <input
                  type="date"
                  className="form-control mb-2"
                  placeholder="วันที่เริ่มทดลองงาน"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
                <input
                  type="date"
                  className="form-control mb-2"
                  placeholder="วันที่สิ้นสุดทดลองงาน"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
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

export default ProbationPage;
