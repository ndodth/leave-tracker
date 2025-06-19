import 'bootstrap/dist/css/bootstrap.min.css';
import { useEffect, useState, useRef } from 'react';
import React from 'react';
import './App.css';
import emailjs from 'emailjs-com';

function App() {
  const fileInputRef = useRef();
  const [leaves, setLeaves] = useState([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    fetch('http://localhost:3000/api/history')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setLeaves(data);
        else setLeaves([]);
      })
      .catch((err) => console.error('Fetch error:', err));
  };

  const sendEmailFromFrontend = async (warningData) => {
    try {
      const response = await emailjs.send(
        "service_jkmc6sy",
        "template_3l3j63j",
        {
          employee_id: warningData.EmployeeID,
          employee_name: warningData.EmployeeName,
          to_email: warningData.Email,
          remaining_days: warningData.Remaining,
          leave_type: warningData.LeaveType
        },
        "d-wSsdetLCRUMcgoO"
      );
      console.log("✅ Email sent:", response.status);
      return true;
    } catch (error) {
      console.error("❌ Email sending failed:", error);
      return false;
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const text = await res.text();
      alert(text);
      fetchData();

      // ดึงพนักงานที่เหลือวันลาติดลบ
      const warningRes = await fetch('http://localhost:3000/api/warning');
      const warningData = await warningRes.json();

      if (Array.isArray(warningData)) {
        let successCount = 0;
        for (const user of warningData) {
          const success = await sendEmailFromFrontend(user);
          if (success) successCount++;
        }
        alert(`📧 แจ้งเตือนอีเมล ${successCount}/${warningData.length} คน`);
      }

    } catch (error) {
      alert('❌ Upload failed');
      console.error(error);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const filteredLeaves = leaves.filter((leave) =>
    leave.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    leave.id?.toString().includes(search)
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredLeaves.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredLeaves.length / itemsPerPage);

  return (
    <div className="container">
      <header className="d-flex flex-wrap justify-content-center py-3 mb-4 border-bottom">
        <a href="/" className="d-flex align-items-center mb-3 mb-md-0 me-md-auto text-dark text-decoration-none">
          <span className="fs-4 fw-bold" style={{ color: '#293cc6' }}>Vanness Plus</span>
        </a>
        <ul className="nav nav-pills">
          <li className="nav-item"><a href="#" className="nav-link active">Home</a></li>
        </ul>
      </header>

      <div className="text-center mb-4">
        <h1 className="display-5 fw-bold">🌿 Leaves History</h1>
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mt-4 gap-3">
          <button className="btn btn-success" onClick={handleUploadClick}>📤 Upload ข้อมูล</button>
          <input type="file" accept=".xlsx" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
          <input type="text" className="form-control w-100 w-md-50" placeholder="🔍 ค้นหาด้วยรหัสลา หรือชื่อ" value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} />
        </div>
      </div>

      <div className="table-responsive table-container mt-4">
        <table className="table table-striped table-bordered text-center mb-0">
          <thead className="table-primary">
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Site</th>
              <th>Type</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Remaining</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.length > 0 ? (
              currentItems.map((leave, idx) => (
                <tr key={leave.id ?? `leave-${idx}`} className={leave.remaining_leave_days < 0 ? 'table-danger text-white' : ''}>
                  <td>{leave.id}</td>
                  <td>{leave.employee_name}</td>
                  <td>{leave.site}</td>
                  <td>{leave.leave_type_name}</td>
                  <td>{leave.start_date}</td>
                  <td>{leave.end_date}</td>
                  <td>{leave.remaining_leave_days}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7">⏳ กำลังโหลดข้อมูล หรือไม่พบข้อมูล</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav className="d-flex justify-content-center mt-4">
          <ul className="pagination">
            {Array.from({ length: totalPages }, (_, i) => (
              <li key={i} className={`page-item ${currentPage === i + 1 ? 'active' : ''}`}>
                <button className="page-link" onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

export default App;
