// HomePage.jsx (React)
import React, { useEffect, useState, useRef } from 'react';
import emailjs from 'emailjs-com';
import './App.css';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
function HomePage() {
    const fileInputRef = useRef();
    const [leaves, setLeaves] = useState([]);
    const [summaryData, setSummaryData] = useState([]);
    const [mode, setMode] = useState('table');
    const [search, setSearch] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedYear, setSelectedYear] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const [summaryPage, setSummaryPage] = useState(1);
    const summaryPerPage = 20;



    const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const typeColors = {
        "Sick Leave": "#ef5350",
        "Vacation Leave": "#42a5f5",
        "Business Leave": "#ffca28"
    };
    useEffect(() => { fetchData(); }, []);
    useEffect(() => {
        fetchSummary();
    }, [selectedMonth, selectedYear]);
    const fetchData = () => {
        fetch('http://localhost:3000/api/history')
            .then((res) => res.json())
            .then((data) => {
                console.log('📄 data', data);
                Array.isArray(data) ? setLeaves(data) : setLeaves([]);
            })
            .catch((err) => console.error('Fetch error:', err));
    };

    const fetchSummary = async () => {
        try {
            let url = `https://leave-tracker-production-8bcc.up.railway.app/api/summary?year=${selectedYear}`;
            if (selectedMonth) {
                url += `&month=${selectedMonth}`;
            }
            const res = await fetch(url);
            if (!res.ok) throw new Error("ไม่พบข้อมูลสรุป");
            const data = await res.json();
            setSummaryData(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("❌ Summary fetch error:", err);
            setSummaryData([]);
        }
    };

    const handleFileChange = async (e) => {
        setCurrentPage(1); // Reset to first page on new upload
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('http://localhost:3000/api/upload', {
                method: 'POST', body: formData,
            });
            const text = await res.text();
            alert(text);
             if (!res.ok) return;
            fetchData();
            
            const warningRes = await fetch('https://leave-tracker-production-8bcc.up.railway.app/api/warning');
            const warningData = await warningRes.json();

            if (Array.isArray(warningData)) {
                let successCount = 0;
                for (const user of warningData) {
                    const success = await emailjs.send(
                        "service_jkmc6sy", "template_3l3j63j",
                        {
                            employee_id: user.EmployeeID,
                            employee_name: user.EmployeeName,
                            to_email: user.Email,
                            remaining_days: user.Remaining,
                            leave_type: user.LeaveType
                        },
                        "d-wSsdetLCRUMcgoO"
                    );
                    if (success) {
                        // อัปเดตสถานะเตือนใน backend
                        await fetch('https://leave-tracker-production-8bcc.up.railway.app/api/update-warning', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ warning_id: user.WarningID }) // <<-- ส่งรหัสลาไป
                        });
                        successCount++;
                    }
                }
                alert(`📧 แจ้งเตือนอีเมล ${successCount}/${warningData.length} คน`);
            }
        } catch (error) {
            alert('❌ Upload failed');
            console.error(error);
        }
    };


    const handleUploadClick = () => fileInputRef.current.click();


    const filteredLeaves = leaves.filter((leave) => {
        const matchesSearch =
            leave.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
            leave.id?.toString().includes(search);

        const date = new Date(leave.start_date);
       const matchesMonthYear =
    (!selectedMonth || date.getMonth() + 1 === Number(selectedMonth)) &&
    (!selectedYear || date.getFullYear() === Number(selectedYear));

        return matchesSearch && matchesMonthYear;
    });


    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredLeaves.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredLeaves.length / itemsPerPage);


    const filteredSummary = summaryData.filter((s) =>
        s.employee_id?.toString().includes(search) ||
        s.employee_name?.toLowerCase().includes(search.toLowerCase())
    );
    const indexOfLastSummary = summaryPage * summaryPerPage;
    const indexOfFirstSummary = indexOfLastSummary - summaryPerPage;
    const currentSummary = filteredSummary.slice(indexOfFirstSummary, indexOfLastSummary);
    const totalSummaryPages = Math.ceil(filteredSummary.length / summaryPerPage);



    const empMap = {};
    filteredLeaves.forEach((l) => {
        const id = l.employee_id;
        if (!empMap[id]) {
            empMap[id] = {
                employee_name: l.employee_name,
                leaves: []
            };
        }
        empMap[id].leaves.push(l);
    });
    const employees = Object.values(empMap);
    const daysInMonth = selectedMonth
        ? new Date(selectedYear, selectedMonth, 0).getDate()
        : 31; const handleDownloadExcel = () => {
            const wsData = currentItems.map(item => ({
                Email: item.employee_email,
                Leave_Start_Date: item.start_date.substr(0, 10),
                Leave_End_Date: item.end_date.substr(0, 10),
                Type_Of_Leave: item.leave_type_name,
                Site: item.site,
            }));
            const ws = XLSX.utils.json_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
            const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            saveAs(new Blob([buf], { type: 'application/octet-stream' }), `leave_page_${currentPage}.xlsx`);
        };

    function renderCalendarHeader() {
        if (!selectedMonth) return null;
        return (
            <div className="calendar-header d-flex border-bottom py-2 bg-light sticky-top" style={{ zIndex: 10 }}>
                <div style={{ width: '150px', fontWeight: 'bold', background: '#f8fafc' }}>ชื่อ</div>
                {Array.from({ length: daysInMonth }, (_, i) => {
                    const date = new Date(selectedYear, selectedMonth - 1, i + 1);
                    const weekday = date.toLocaleDateString('th-TH', { weekday: 'short' });
                    return (
                        <div key={i} style={{
                            width: '38px',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            color: '#1976d2',
                            background: '#f8fafc',
                            fontSize: 13,
                            borderLeft: i === 0 ? undefined : '1px solid #e3e8ee'
                        }}>
                            <div>{i + 1}</div>
                            <div style={{ fontSize: 11, color: '#888' }}>{weekday}</div>
                        </div>
                    );
                })}
            </div>
        );
    }

    // เพิ่มฟังก์ชันแสดงตัวอย่างไฟล์อัปโหลด
    const handleShowTemplate = () => {
        // ตัวเลือก dropdown ที่ควรใช้
        const leaveTypes = ["Sick Leave", "Vacation Leave", "Business Leave"];
        const sites = ["Office", "WFH"];

        // Sheet หลัก
        const wsData = [
            ["Email", "Leave Start Date", "Leave End Date", "Type Of Leave", "Site"],
            ["ndodth@gmail.com", "2024-06-01", "2024-06-03", leaveTypes[0], sites[0]],
            ["ndodth@gmail.com", "2024-06-05", "2024-06-07", leaveTypes[1], sites[0]],
           ];

        // Sheet2: ตัวเลือก dropdown
        const wsOptions = [
            ["Type Of Leave ","Site"],
            ["Business Leave", "Office"],
            ["Sick Leave", "WFH"],
            ["Vacation Leave",""],
        ];

        const wb = XLSX.utils.book_new();
        const ws1 = XLSX.utils.aoa_to_sheet(wsData);
        const ws2 = XLSX.utils.aoa_to_sheet(wsOptions);

        XLSX.utils.book_append_sheet(wb, ws1, 'Template');
        XLSX.utils.book_append_sheet(wb, ws2, 'Options');

        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        saveAs(new Blob([buf], { type: 'application/octet-stream' }), 'leave_upload_template.xlsx');
    };

    return (
        <div className="container my-5">
            <header className="mb-4 text-center">
                <h1 className="display-4 fw-bold text-primary">Vanness Plus - ระบบบันทึกการลา</h1>
                <p className="lead text-secondary">จัดการข้อมูลวันลาของพนักงานอย่างง่ายและมีประสิทธิภาพ</p>
            </header>

            <div className="d-flex flex-wrap justify-content-center gap-3 mb-4">
                <button className={`btn btn-lg ${mode === 'table' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setMode('table')}>📄 แสดงตาราง</button>
                <button className={`btn btn-lg ${mode === 'calendar' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setMode('calendar')}>🗓️ ปฏิทิน</button>
                <button className={`btn btn-lg ${mode === 'summary' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => { setMode('summary'); fetchSummary(); }}>📊 โหมดสรุป</button>
                <button
                    className="btn btn-outline-secondary btn-lg"
                    onClick={() => {
                        setSelectedMonth('');
                        setSelectedYear(new Date().getFullYear());
                        setSearch('');
                    }}
                >
                    🧹 ล้างตัวกรอง
                </button>
                <select
                    className="form-select form-select-lg w-auto"
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                >
                    <option value="">--เลือกเดือน--</option>
                    {months.map((m, i) => (
                        <option key={i + 1} value={i + 1}>{m}</option>
                    ))}
                </select>
                <select
                    className="form-select form-select-lg w-auto"
                    value={selectedYear}
                    onChange={e => setSelectedYear(e.target.value)}
                >
                    <option value="">--เลือกปี--</option>
                    {[2024, 2025, 2026].map((y) => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            </div>

            <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-3 mb-5">
                <div className="d-flex gap-2">
                    <button className="btn btn-success btn-lg shadow-sm" onClick={handleUploadClick}>📤 Upload ข้อมูล</button>
                    <button className="btn btn-outline-info btn-lg shadow-sm" onClick={handleShowTemplate}>
                        📄 ตัวอย่างไฟล์อัปโหลด
                    </button>
                </div>
                <input type="file" accept=".xlsx" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                <input type="search" className="form-control form-control-lg shadow-sm" placeholder="🔍 ค้นหาด้วยรหัสหรือชื่อพนักงาน..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 350 }} />
            </div>

            {mode === 'calendar' ? (
                <div className="calendar-container">
                    {renderCalendarHeader()}
                    {employees.map((emp, idx) => (
                        <div key={idx} className="d-flex align-items-center py-1 border-bottom position-relative calendar-row" style={{ minHeight: 38 }}>
                            <div style={{ width: '150px', fontWeight: 500, color: '#333' }}>{emp.employee_name}</div>
                            <div className="flex-grow-1 position-relative" style={{ height: 34 }}>
                                {emp.leaves.map((l, j) => {
                                    // --- FIX: Make leave bar end at the correct day and only show part in this month ---
                                    const startDate = new Date(l.start_date);
                                    const endDate = new Date(l.end_date);

                                    // Clamp leave to current month
                                    const leaveStart = new Date(selectedYear, selectedMonth - 1, 1);
                                    const leaveEnd = new Date(selectedYear, selectedMonth - 1, daysInMonth, 23, 59, 59, 999);

                                    // Calculate the visible start and end dates within this month
                                    const visibleStart = startDate < leaveStart ? leaveStart : startDate;
                                    const visibleEnd = endDate > leaveEnd ? leaveEnd : endDate;

                                    // If leave is completely outside this month, skip
                                    if (visibleEnd < leaveStart || visibleStart > leaveEnd) return null;

                                    // FIX: Make the bar end at the correct day (bar should end at the END of the leave day, not the start of the next day)
                                    // So, if leave ends at 10, the bar should cover up to 10, not 11
                                    const startDay = visibleStart.getDate();
                                    const endDay = visibleEnd.getDate();

                                    // The width should be (endDay - startDay + 1) days
                                    const leftPct = (startDay - 1) / daysInMonth * 100;
                                    const widthPct = (endDay - startDay + 1) / daysInMonth * 100;
                                    const days = (visibleEnd - visibleStart) / (1000 * 60 * 60 * 24) + 1;
                                    const bg = typeColors[l.leave_type_name] || '#66bb6a';


                                    let adjustedEndDay = endDay;
                                    if (
                                        visibleEnd.getHours() === 0 &&
                                        visibleEnd.getMinutes() === 0 &&
                                        visibleEnd.getSeconds() === 0 &&
                                        visibleEnd.getMilliseconds() === 0 &&
                                        (visibleEnd > visibleStart)
                                    ) {
                                        adjustedEndDay = endDay - 1;
                                    }
                                    // Clamp adjustedEndDay
                                    if (adjustedEndDay < startDay) adjustedEndDay = startDay;

                                    const adjustedWidthPct = ((adjustedEndDay - startDay + 1) / daysInMonth * 100);
                                    const adjustedDays = adjustedEndDay - startDay + 1;

                                    // If adjustedDays < 1, skip
                                    if (adjustedDays < 1) return null;

                                    return (
                                        <div
                                            key={j}
                                            tabIndex={0}
                                            style={{
                                                position: 'absolute',
                                                left: `${leftPct}%`,
                                                width: `${adjustedWidthPct}%`,
                                                height: 28,
                                                backgroundColor: bg,
                                                opacity: 0.9,
                                                borderRadius: 6,
                                                cursor: 'pointer',
                                                pointerEvents: 'auto',
                                                zIndex: 2,
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                                border: '2px solid #fff',
                                                transition: 'transform 0.1s'
                                            }}
                                            className="calendar-leave-bar"
                                            title={`${l.leave_type_name}: ${adjustedDays} วัน (${l.start_date.substr(0, 10)} - ${l.end_date.substr(0, 10)})`}
                                            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                                        >
                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    width: '100%',
                                                    height: '100%',
                                                    top: 0,
                                                    left: 0,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#fff',
                                                    fontWeight: 500,
                                                    fontSize: 13,
                                                    textShadow: '0 1px 2px rgba(0,0,0,0.15)'
                                                }}
                                            >
                                                {l.leave_type_name === "Sick Leave" ? "ป่วย" :
                                                    l.leave_type_name === "Vacation Leave" ? "พักร้อน" :
                                                        l.leave_type_name === "Business Leave" ? "ลากิจ" : l.leave_type_name}
                                                <span style={{ marginLeft: 4 }}>({adjustedDays})</span>
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    <style>{`
                        .calendar-row:hover {
                            background: #f5faff;
                        }
                        .calendar-leave-bar:focus {
                            outline: 2px solid #1976d2;
                        }
                    `}</style>
                </div>
            ) : mode === 'summary' ? (
                <div>
                    <div className="row g-4 mb-4">
                        {filteredSummary.length > 0 && (
                            <>
                                <div className="col-12 col-md-3">
                                    <div className="card shadow-sm border-0 h-100 text-center bg-primary text-white">
                                        <div className="card-body">
                                            <div style={{ fontSize: 36, fontWeight: 700 }}>{filteredSummary.reduce((sum, s) => sum + (s.total_days || 0), 0)}</div>
                                            <div className="mt-2" style={{ fontSize: 18 }}>รวมวันลา</div>
                                            <div style={{ fontSize: 24 }}>📊</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-12 col-md-3">
                                    <div className="card shadow-sm border-0 h-100 text-center" style={{ background: typeColors["Sick Leave"], color: '#fff' }}>
                                        <div className="card-body">
                                            <div style={{ fontSize: 36, fontWeight: 700 }}>{filteredSummary.reduce((sum, s) => sum + (s.sick_days || 0), 0)}</div>
                                            <div className="mt-2" style={{ fontSize: 18 }}>ลาป่วย</div>
                                            <div style={{ fontSize: 24 }}>🤒</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-12 col-md-3">
                                    <div className="card shadow-sm border-0 h-100 text-center" style={{ background: typeColors["Vacation Leave"], color: '#fff' }}>
                                        <div className="card-body">
                                            <div style={{ fontSize: 36, fontWeight: 700 }}>{filteredSummary.reduce((sum, s) => sum + (s.vacation_days || 0), 0)}</div>
                                            <div className="mt-2" style={{ fontSize: 18 }}>ลาพักร้อน</div>
                                            <div style={{ fontSize: 24 }}>🏖️</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-12 col-md-3">
                                    <div className="card shadow-sm border-0 h-100 text-center" style={{ background: typeColors["Business Leave"], color: '#fff' }}>
                                        <div className="card-body">
                                            <div style={{ fontSize: 36, fontWeight: 700 }}>{filteredSummary.reduce((sum, s) => sum + (s.business_days || 0), 0)}</div>
                                            <div className="mt-2" style={{ fontSize: 18 }}>ลากิจ</div>
                                            <div style={{ fontSize: 24 }}>🏢</div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="table-responsive">
                        <table className="table table-bordered table-striped text-center mb-0 align-middle shadow-sm rounded">
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
                                {currentSummary.length > 0 ? (
                                    currentSummary.map((s, i) => (
                                        <tr key={i}>
                                            <td className="fw-bold">{s.employee_name}</td>
                                            <td><span className="badge bg-primary fs-6">{s.total_days}</span></td>
                                            <td><span className="badge" style={{ background: typeColors["Sick Leave"], color: '#fff' }}>{s.sick_days}</span></td>
                                            <td><span className="badge" style={{ background: typeColors["Vacation Leave"], color: '#fff' }}>{s.vacation_days}</span></td>
                                            <td><span className="badge" style={{ background: typeColors["Business Leave"], color: '#fff' }}>{s.business_days}</span></td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="text-muted fst-italic py-4">⏳ ไม่มีข้อมูลสรุป</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        {totalSummaryPages > 1 && (
                            <nav className="d-flex justify-content-center mt-3">
                                <ul className="pagination">
                                    {Array.from({ length: totalSummaryPages }, (_, i) => (
                                        <li key={i} className={`page-item ${summaryPage === i + 1 ? 'active' : ''}`}>
                                            <button className="page-link" onClick={() => setSummaryPage(i + 1)}>
                                                {i + 1}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </nav>
                        )}
                    </div>
                </div>
            ) : (
                <div className="table-responsive">
                    <div className="d-flex justify-content-end mb-3">
                        <button className="btn btn-outline-success" onClick={handleDownloadExcel}>
                            📥 ดาวน์โหลด .xlsx หน้านี้
                        </button>
                    </div>
                    <table className="table table-bordered align-middle text-center shadow-sm rounded">
                        <thead className="table-primary">
                            <tr>
                                <th>ID</th>
                                <th>ชื่อ</th>
                                <th>Email</th>
                                <th>Site</th>
                                <th>ประเภท</th>
                                <th>เริ่ม</th>
                                <th>สิ้นสุด</th>
                                <th>คงเหลือ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentItems.map((l, idx) => (
                                <tr key={l.id ?? idx} className={l.remaining_leave_days < 0 ? 'table-danger text-white fw-bold' : ''}>
                                    <td>{l.id}</td>
                                    <td>{l.employee_name}</td>
                                    <td>{l.employee_email || '-'}</td>
                                    <td>{l.site}</td>
                                    <td>
                                        <span className="badge" style={{
                                            background: typeColors[l.leave_type_name] || '#bdbdbd',
                                            color: '#fff',
                                            fontSize: 15,
                                            padding: '6px 14px'
                                        }}>
                                            {l.leave_type_name === "Sick Leave" ? "ป่วย" :
                                                l.leave_type_name === "Vacation Leave" ? "พักร้อน" :
                                                    l.leave_type_name === "Business Leave" ? "ลากิจ" : l.leave_type_name}
                                        </span>
                                    </td>
                                    <td>{l.start_date.substring(0, 10)}</td>
                                    <td>{l.end_date.substring(0, 10)}</td>
                                    <td>{l.remaining_leave_days}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {totalPages > 1 && (
                        <nav className="d-flex justify-content-center mt-3">
                            <ul className="pagination">
                                {Array.from({ length: totalPages }, (_, i) => (
                                    <li key={i} className={`page-item ${currentPage === i + 1 ? 'active' : ''}`}>
                                        <button className="page-link" onClick={() => setCurrentPage(i + 1)}>
                                            {i + 1}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    )}
                </div>
            )}
        </div>
    );
}

export default HomePage;
