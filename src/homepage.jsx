import React, { useEffect, useState, useRef } from 'react';
import emailjs from 'emailjs-com';

function HomePage() {
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
    fetch('https://leave-tracker-production-8bcc.up.railway.app/api/history')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setLeaves(data);
        else setLeaves([]);
      })
      .catch((err) => console.error('Fetch error:', err));
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch(`https://leave-tracker-production-8bcc.up.railway.app/api/summary?month=${selectedMonth}&year=${selectedYear}`);
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
      await emailjs.send(
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
      const res = await fetch('https://leave-tracker-production-8bcc.up.railway.app/api/upload', {
        method: 'POST',
        body: formData,
      });

      const text = await res.text();
      alert(text);
      fetchData();

      const warningRes = await fetch('https://leave-tracker-production-8bcc.up.railway.app/api/warning');
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
    <div className="container my-5">
      <header className="mb-4 text-center">
        <h1 className="display-4 fw-bold" style={{ color: '#1a237e' }}>Vanness Plus - ระบบบันทึกการลา</h1>
        <p className="lead text-secondary">จัดการข้อมูลวันลาของพนักงานอย่างง่ายและมีประสิทธิภาพ</p>
      </header>

      <div className="d-flex flex-wrap justify-content-center gap-3 mb-4">
        <button
          className={`btn btn-lg ${mode === 'table' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => setMode('table')}
        >
          📄 แสดงตาราง
        </button>
        <button
          className={`btn btn-lg ${mode === 'summary' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => {
            setMode('summary');
            fetchSummary();
          }}
        >
          📊 โหมดสรุป
        </button>

        <select
          className="form-select form-select-lg w-auto"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          aria-label="เลือกเดือน"
        >
          {months.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>

        <select
          className="form-select form-select-lg w-auto"
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          aria-label="เลือกปี"
        >
          {[2024, 2025, 2026].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {mode === 'summary' && (
          <button className="btn btn-info btn-lg" onClick={fetchSummary} aria-label="โหลดข้อมูลสรุป">
            🔄 โหลดข้อมูล
          </button>
        )}
      </div>

      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-3 mb-5">
        <button
          className="btn btn-success btn-lg shadow-sm"
          onClick={handleUploadClick}
          aria-label="อัปโหลดไฟล์ Excel"
        >
          📤 Upload ข้อมูล
        </button>
        <input
          type="file"
          accept=".xlsx"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <input
          type="search"
          className="form-control form-control-lg shadow-sm"
          placeholder="🔍 ค้นหาด้วยรหัสลา หรือชื่อ"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
            setSummaryCurrentPage(1);
          }}
          style={{ maxWidth: 350 }}
          aria-label="ค้นหา"
        />
      </div>

      {/* ตัวอย่างไฟล์ Excel */}
      <section className="mb-5 p-4 bg-white rounded shadow-sm">
        <div className="row align-items-center">
          <div className="col-md-5 mb-3 mb-md-0">
            <img
              src="/sample-excel-format.png"
              alt="ตัวอย่างไฟล์ Excel"
              className="img-fluid rounded border"
              style={{ maxHeight: 220, objectFit: 'contain' }}
            />
          </div>
          <div className="col-md-7">
            <h4 className="fw-bold text-primary mb-3">📌 ตัวอย่างไฟล์ Excel ที่รองรับ</h4>
            <ul className="list-group list-group-flush fs-5" style={{ color: '#555' }}>
              <li className="list-group-item">✅ <b>Email:</b> อีเมลพนักงาน</li>
              <li className="list-group-item">✅ <b>Leave Start Date:</b> วันที่เริ่มลา (dd-mm-yyyy)</li>
              <li className="list-group-item">✅ <b>Leave End Date:</b> วันที่สิ้นสุดลา (dd-mm-yyyy)</li>
              <li className="list-group-item">✅ <b>Type Of Leave:</b> ประเภทวันลา (Business Leave, Sick Leave, Vacation Leave)</li>
              <li className="list-group-item">✅ <b>Site:</b> site ที่ทำงาน (Office, WFH)</li>
            </ul>
            <p className="mt-3 text-muted fst-italic">โปรดตรวจสอบข้อมูลให้ถูกต้องก่อนอัปโหลดเพื่อความแม่นยำ</p>
          </div>
        </div>
      </section>

      {/* ตาราง/สรุป */}
      {mode === 'table' ? (
        <section className="bg-white rounded shadow-sm p-3">
          <div className="table-responsive">
            <table className="table table-hover table-bordered align-middle text-center mb-0">
              <thead className="table-primary">
                <tr>
                  <th>ID</th>
                  <th>ชื่อ</th>
                  <th>Site</th>
                  <th>ประเภท</th>
                  <th>วันเริ่ม</th>
                  <th>วันสิ้นสุด</th>
                  <th>วันลาคงเหลือ</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.length > 0 ? (
                  currentItems.map((leave, idx) => (
                    <tr
                      key={leave.id ?? `leave-${idx}`}
                      className={leave.remaining_leave_days < 0 ? 'table-danger text-white fw-bold' : ''}
                    >
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
                    <td colSpan="7" className="text-muted fst-italic py-4">⏳ กำลังโหลดข้อมูล หรือไม่พบข้อมูล</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <nav aria-label="Pagination Table" className="d-flex justify-content-center mt-3">
              <ul className="pagination pagination-lg">
                {Array.from({ length: totalPages }, (_, i) => (
                  <li
                    key={i}
                    className={`page-item ${currentPage === i + 1 ? 'active' : ''}`}
                  >
                    <button
                      className="page-link"
                      onClick={() => setCurrentPage(i + 1)}
                      aria-current={currentPage === i + 1 ? "page" : undefined}
                    >
                      {i + 1}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </section>
      ) : (
        <section className="bg-white rounded shadow-sm p-3">
          <div className="table-responsive">
            <table className="table table-bordered table-striped text-center mb-0 align-middle">
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
                    <td colSpan="5" className="text-muted fst-italic py-4">⏳ ไม่มีข้อมูลสรุป</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalSummaryPages > 1 && (
            <nav aria-label="Pagination Summary" className="d-flex justify-content-center mt-3">
              <ul className="pagination pagination-lg">
                {Array.from({ length: totalSummaryPages }, (_, i) => (
                  <li
                    key={i}
                    className={`page-item ${summaryCurrentPage === i + 1 ? 'active' : ''}`}
                  >
                    <button
                      className="page-link"
                      onClick={() => setSummaryCurrentPage(i + 1)}
                      aria-current={summaryCurrentPage === i + 1 ? "page" : undefined}
                    >
                      {i + 1}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </section>
      )}
    </div>
  );
}

export default HomePage;
