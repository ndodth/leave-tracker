import React, { useEffect, useState } from 'react';
import './App.css';

function ProbationPage() {
  const [evaluations, setEvaluations] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://leave-tracker-production-8bcc.up.railway.app/api/evaluations')
      .then(res => res.json())
      .then(data => setEvaluations(Array.isArray(data) ? data : []))
      .catch(err => console.error('โหลดข้อมูลผลการประเมินล้มเหลว:', err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = evaluations.filter(e =>
    (e.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
      (e.employee_id + '').includes(search))
  );

  return (
    <div className="probation-bg min-vh-100 py-5">
      <div className="container glass-card p-4 p-md-5 shadow-lg" style={{ borderRadius: 28 }}>
        <h2 className="text-center fw-bold mb-4" style={{ color: '#5461cf', letterSpacing: 1 }}>
          <span style={{fontSize:32}}>📝</span> ผลการประเมินทดลองงาน
        </h2>
        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
          <input
            type="search"
            className="form-control form-control-lg shadow-sm"
            placeholder="🔍 ค้นหาชื่อ/รหัสพนักงาน"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 350, borderRadius: 18 }}
          />
        </div>
        <div className="table-responsive">
          <table className="table table-hover table-bordered align-middle text-center shadow-sm rounded">
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
                      <span className="badge bg-success">เสร็จสิ้น</span>
                    ) : (
                      <span className="badge bg-warning text-dark">รอดำเนินการ</span>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={10} className="text-muted py-4">
                    <img src="https://cdn-icons-png.flaticon.com/512/4076/4076549.png" alt="empty" style={{width:80,opacity:0.5}} />
                    <div className="mt-3">ไม่พบข้อมูล</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`
        .probation-bg {
          background: linear-gradient(135deg, #e0eaff 0%, #fef6ff 100%);
        }
        .glass-card {
          background: rgba(255,255,255,0.85);
          border-radius: 28px;
          box-shadow: 0 8px 32px 0 rgba(84,97,207,0.12);
          backdrop-filter: blur(8px);
          border: 1.5px solid #e3e8ee;
        }
      `}</style>
    </div>
  );
}

export default ProbationPage;
