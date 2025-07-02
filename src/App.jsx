import 'bootstrap/dist/css/bootstrap.min.css';
import React from 'react';
import './App.css'; 
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage from './homepage';
import EmployeePage from './EmployeePage';
import Probation from './Probation';
import AssessmentFeedback from './AssessmentFeedback'; // เพิ่มบรรทัดนี้

function App() {
  return (
    <Router>
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
        <div className="container">
          <Link className="navbar-brand fw-bold" to="/">Vanness Plus</Link>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto">
              <li className="nav-item">
                <Link className="nav-link" to="/">หน้าหลัก</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/employees">ข้อมูลพนักงาน</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/Probation">Probation</Link>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/employees" element={<EmployeePage />} />
        <Route path="/Probation" element={<Probation />} />
<Route path="/assessment-feedback/:probation_id" element={<AssessmentFeedback />} />      </Routes>
    </Router>
  );
}

export default App;
