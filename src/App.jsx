import 'bootstrap/dist/css/bootstrap.min.css';
import React from 'react';
import './App.css'; 
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import HomePage from './homepage';
import EmployeePage from './EmployeePage';
import Probation from './Probation';
import AssessmentFeedback from './AssessmentFeedback';
import Login from './Login.jsx';

function App() {
  const [token, setToken] = React.useState(localStorage.getItem('token'));

  return (
    <Router>
      {!token ? (
        <Routes>
          <Route path="*" element={<Login onLogin={setToken} />} />
        </Routes>
      ) : (
        <>
          <nav className="navbar navbar-expand-lg glass-nav shadow-sm mb-4">
            <div className="container">
              <Link className="navbar-brand fw-bold d-flex align-items-center" to="/">
                <img src="/src/assets/logo.jpeg" alt="logo" style={{width:36,marginRight:10,borderRadius:8}} />
                Vanness Plus
              </Link>
              <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span className="navbar-toggler-icon"></span>
              </button>
              <div className="collapse navbar-collapse" id="navbarNav">
                <ul className="navbar-nav ms-auto">
                  <li className="nav-item"><Link className="nav-link" to="/">หน้าหลัก</Link></li>
                  <li className="nav-item"><Link className="nav-link" to="/employees">พนักงาน</Link></li>
                  <li className="nav-item"><Link className="nav-link" to="/Probation">ทดลองงาน</Link></li>
                  <button className="btn btn-outline-danger ms-3" onClick={() => {
                    localStorage.removeItem('token');
                    setToken(null);
                  }}>
                    ออกจากระบบ
                  </button>
                </ul>
              </div>
            </div>
          </nav>

          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/employees" element={<EmployeePage />} />
            <Route path="/Probation" element={<Probation />} />
            <Route path="/assessment-feedback/:probation_id" element={<AssessmentFeedback />} />
            <Route path="/login" element={<Navigate to="/" />} /> {/* ป้องกันคน login แล้วเข้าหน้านี้ */}
          </Routes>
        </>
      )}
    </Router>
  );
}

export default App;

