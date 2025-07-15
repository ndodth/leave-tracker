import React, { useState } from 'react';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setStatus('');
    try {
      const res = await fetch('https://exotic-ashil-vanness-09720f79.koyeb.app/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('token', data.token);
        setStatus('✅ เข้าสู่ระบบสำเร็จ');
        onLogin && onLogin(data.token);
      } else {
        setStatus(data.error || '❌ อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      }
    } catch (err) {
      setStatus('❌ เกิดข้อผิดพลาด');
    }
    setLoading(false);
  };

  return (
    <div className="login-bg min-vh-100 d-flex align-items-center justify-content-center">
      <div className="glass-card p-4 p-md-5 shadow-lg" style={{ borderRadius: 28, minWidth: 340, maxWidth: 400 }}>
        <h2 className="mb-4 text-center fw-bold" style={{ color: '#5461cf' }}>เข้าสู่ระบบ</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">อีเมล</label>
            <input
              type="email"
              className="form-control form-control-lg"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="mb-3">
            <label className="form-label">รหัสผ่าน</label>
            <input
              type="password"
              className="form-control form-control-lg"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary btn-lg w-100" type="submit" disabled={loading}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
          {status && <div className={`mt-3 text-center ${status.startsWith('✅') ? 'text-success' : 'text-danger'}`}>{status}</div>}
        </form>
      </div>
      <style>{`
        .login-bg {
          background: linear-gradient(135deg, #e0eaff 0%, #fef6ff 100%);
        }
      `}</style>
    </div>
  );
}

export default Login;