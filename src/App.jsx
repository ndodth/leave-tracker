import 'bootstrap/dist/css/bootstrap.min.css';
import { useEffect, useState, useRef } from 'react';
import React from 'react';
import './App.css';
import emailjs from 'emailjs-com';

function App() {
  const fileInputRef = useRef();
  const [leaves, setLeaves] = useState([]);
  const [summaryData, setSummaryData] = useState([]);
  const [mode, setMode] = useState('table');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [summaryCurrentPage, setSummaryCurrentPage] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const itemsPerPage = 20;
  const summaryItemsPerPage = 10;

  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    fetch('https://leave-tracker-production-8bcc.up.railway.app//api/history')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setLeaves(data);
        else setLeaves([]);
      })
      .catch((err) => console.error('Fetch error:', err));
  };

  const fetchSummary = async () => {
    try {
      console.log(`Fetching summary for ${selectedMonth}/${selectedYear}`);
      const res = await fetch(`https://leave-tracker-production-8bcc.up.railway.app//api/summary?month=${selectedMonth}&year=${selectedYear}`);
      if (!res.ok) throw new Error("ไม่พบข้อมูลสรุป");
      const data = await res.json();
      if (Array.isArray(data)) {
        setSummaryData(data);
      } else {
        setSummaryData([]);
      }
      setSummaryCurrentPage(1);
    } catch (err) {
      console.error("❌ Summary fetch error:", err);
      setSummaryData([]);
    }
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
      const res = await fetch('https://leave-tracker-production-8bcc.up.railway.app//api/upload', {
        method: 'POST',
        body: formData,
      });

      const text = await res.text();
      alert(text);
      fetchData();

      const warningRes = await fetch('https://leave-tracker-production-8bcc.up.railway.app//api/warning');
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

  const filteredLeaves = leaves.filter((leave) => {
    const matchesSearch =
      leave.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
      leave.id?.toString().includes(search);

    const date = new Date(leave.start_date);
    const matchesMonthYear =
      date.getMonth() + 1 === selectedMonth &&
      date.getFullYear() === selectedYear;

    return matchesSearch && matchesMonthYear;
  });

  const filteredSummary = summaryData.filter((s) =>
    s.employee_name?.toLowerCase().includes(search.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredLeaves.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredLeaves.length / itemsPerPage);

  const indexOfLastSummary = summaryCurrentPage * summaryItemsPerPage;
  const indexOfFirstSummary = indexOfLastSummary - summaryItemsPerPage;
  const currentSummaryItems = filteredSummary.slice(indexOfFirstSummary, indexOfLastSummary);
  const totalSummaryPages = Math.ceil(filteredSummary.length / summaryItemsPerPage);

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
        <h1 className="display-5 fw-bold">📝 Leaves History - {months[selectedMonth - 1]} {selectedYear}</h1>
        <div className="d-flex flex-wrap justify-content-center gap-3 mt-3">
          <button className={`btn btn-${mode === 'table' ? 'primary' : 'outline-primary'}`} onClick={() => setMode('table')}>📄 แสดงเป็นตาราง</button>
          <button className={`btn btn-${mode === 'summary' ? 'primary' : 'outline-primary'}`} onClick={() => { setMode('summary'); fetchSummary(); }}>📊 โหมดสรุป</button>
          <select className="form-select w-auto" value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
            {months.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select className="form-select w-auto" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {mode === 'summary' && (
            <button className="btn btn-info" onClick={fetchSummary}>🔄 โหลดข้อมูล</button>
          )}
        </div>

        <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mt-4 gap-3">
          <button className="btn btn-success" onClick={handleUploadClick}>📤 Upload ข้อมูล</button>
          <input type="file" accept=".xlsx" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
          <input
            type="text"
            className="form-control w-100 w-md-50"
            placeholder="🔍 ค้นหาด้วยรหัสลา หรือชื่อ"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
              setSummaryCurrentPage(1);
            }}
          />
        </div>
      </div>

      {mode === 'table' ? (
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
                    <td>{leave.start_date?.substring(0, 10)}</td>
                    <td>{leave.end_date?.substring(0, 10)}</td>
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
      ) : (
        <>
          <div className="table-responsive mt-4">
            <table className="table table-bordered text-center">
              <thead className="table-info">
                <tr>
                  <th>ชื่อพนักงาน</th>
                  <th>รวมวันลา</th>
                  <th>ลาป่วย</th>
                  <th>ลาพักร้อน</th>
                  <th>ลากิจ</th>
                </tr>
              </thead>
              <tbody>
                {currentSummaryItems.length > 0 ? (
                  currentSummaryItems.map((s, i) => (
                    <tr key={i}>
                      <td>{s.employee_name}</td>
                      <td>{s.total_days}</td>
                      <td>{s.sick_days}</td>
                      <td>{s.vacation_days}</td>
                      <td>{s.business_days}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5">⏳ ไม่มีข้อมูลสรุป</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalSummaryPages > 1 && (
            <nav className="d-flex justify-content-center mt-3">
              <ul className="pagination">
                {Array.from({ length: totalSummaryPages }, (_, i) => (
                  <li key={i} className={`page-item ${summaryCurrentPage === i + 1 ? 'active' : ''}`}>
                    <button className="page-link" onClick={() => setSummaryCurrentPage(i + 1)}>
                      {i + 1}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </>
      )}

      {mode === 'table' && totalPages > 1 && (
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
