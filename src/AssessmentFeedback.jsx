import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function AssessmentFeedback() {
  // ดึง probation_id, role จาก query string
  const params = new URLSearchParams(window.location.search);
  const probation_id = params.get('probation_id') || window.location.pathname.split('/').pop();
  const role = params.get('role') || 'manager'; // หรือ 'hr' (อาจต้องแนบในลิงก์อีเมล)
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate(); // เพิ่มบรรทัดนี้

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setStatus('');
    try {
      const res = await fetch('https://exotic-ashil-vanness-09720f79.koyeb.app/api/probation-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          probation_id: Number(probation_id),
          role,
          comment,
        }),
      });
      if (res.ok) {
        setStatus('✅ ส่งผลการประเมินเรียบร้อยแล้ว ขอบคุณค่ะ');
        setComment('');
        setTimeout(() => {
          navigate('/'); // redirect ไปหน้าหลักหลังส่งสำเร็จ
        }, 1500);
      } else {
        setStatus('❌ ไม่สามารถส่งผลการประเมิน');
      }
    } catch (err) {
      setStatus('❌ เกิดข้อผิดพลาด');
    }
    setLoading(false);
  };

  return (
    <div className="container my-5" style={{ maxWidth: 500 }}>
      <div className="card shadow-sm border-0">
        <div className="card-body">
          <h2 className="mb-4 text-primary text-center">ฟอร์มประเมินพนักงานช่วงทดลองงาน</h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">ความคิดเห็น/ข้อเสนอแนะ</label>
              <textarea
                className="form-control"
                rows={5}
                value={comment}
                onChange={e => setComment(e.target.value)}
                required
                placeholder="กรอกผลการประเมินหรือข้อเสนอแนะที่นี่"
              />
            </div>
            <button className="btn btn-success w-100" type="submit" disabled={loading}>
              {loading ? 'กำลังส่ง...' : 'ส่งผลการประเมิน'}
            </button>
            {status && <div className={`mt-3 text-center ${status.startsWith('✅') ? 'text-success' : 'text-danger'}`}>{status}</div>}
          </form>
        </div>
      </div>
    </div>
  );
}

export default AssessmentFeedback;