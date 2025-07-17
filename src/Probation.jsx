import React, { useEffect, useState } from "react";
import "./App.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { FaFileExcel } from "react-icons/fa";
import * as XLSX from "xlsx";

function ProbationPage() {
  const [evaluations, setEvaluations] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [site, setSite] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [sites, setSites] = useState([]);
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // ✅ โหลด meta data
  useEffect(() => {
    const loadMetaData = async () => {
      try {
        const siteRes = await fetch(
          "https://exotic-ashil-vanness-09720f79.koyeb.app/api/sites"
        );
        const siteData = await siteRes.json();
        if (Array.isArray(siteData)) setSites(siteData);
        else if (Array.isArray(siteData.sites)) setSites(siteData.sites);

        const metaRes = await fetch(
          "https://exotic-ashil-vanness-09720f79.koyeb.app/api/meta-options"
        );
        const metaData = await metaRes.json();
        setPositions(metaData.positions || []);
        setDepartments(metaData.departments || []);
      } catch (err) {
        console.error("โหลด meta-data ล้มเหลว:", err);
      }
    };
    loadMetaData();
  }, []);

  // ✅ โหลดข้อมูลการประเมิน
  useEffect(() => {
    const loadEvaluations = async () => {
      try {
        const res = await fetch(
          "https://exotic-ashil-vanness-09720f79.koyeb.app/api/evaluations"
        );
        const data = await res.json();
        setEvaluations(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("โหลดข้อมูลผลการประเมินล้มเหลว:", err);
      } finally {
        setLoading(false);
      }
    };
    loadEvaluations();
  }, []);

  // ✅ กรองข้อมูล
  const filtered = evaluations.filter(
    (e) =>
      e?.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
      (e?.employee_id + "").includes(search)
  );

  // ✅ เพิ่มพนักงานใหม่
  const handleAddEmployee = async () => {
    if (!name || !email || !site || !position || !department || !startDate || !endDate) {
      alert("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    try {
      const res = await fetch(
        "https://exotic-ashil-vanness-09720f79.koyeb.app/api/add-employee",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            site,
            position,
            department,
            start_date: startDate,
            end_date: endDate,
          }),
        }
      );

      if (res.ok) {
        setShowAddModal(false);
        setName("");
        setEmail("");
        setSite("");
        setPosition("");
        setDepartment("");
        setStartDate("");
        setEndDate("");

        // ✅ refresh data หลังเพิ่ม
        const updated = await fetch(
          "https://exotic-ashil-vanness-09720f79.koyeb.app/api/evaluations"
        ).then((r) => r.json());
        setEvaluations(updated);
      } else {
        alert("❌ เพิ่มพนักงานไม่สำเร็จ");
      }
    } catch (err) {
      console.error("เพิ่มพนักงานล้มเหลว:", err);
      alert("เกิดข้อผิดพลาดในการเพิ่มพนักงาน");
    }
  };

  // ✅ ดาวน์โหลด Excel
  const handleDownloadExcel = () => {
    const exportData = filtered.map((e) => ({
      รหัสประเมิน: e.id,
      รหัสทดลองงาน: e.probation_id,
      รหัสพนักงาน: e.employee_id,
      ชื่อพนักงาน: e.employee_name,
      บทบาทผู้ประเมิน:
        e.role === "manager" ? "หัวหน้า" : e.role === "hr" ? "HR" : e.role,
      รหัสผู้ประเมิน: e.evaluator_id,
      ชื่อผู้ประเมิน: e.evaluator_name,
      ความคิดเห็น: e.comment,
      เวลาส่งประเมิน: e.evaluation_time
        ? new Date(e.evaluation_time).toLocaleString()
        : "",
      สถานะ: e.comment ? "เสร็จสิ้น" : "รอดำเนินการ",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ผลการประเมิน");
    XLSX.writeFile(wb, "probation_evaluations.xlsx");
  };

  return (
    <div className="probation-bg min-vh-100 py-5">
      {/* ✅ style พื้นหลัง + card */}
      <style>{`
        .probation-bg {
          background: linear-gradient(135deg, #e0eaff 0%, #fef6ff 100%);
        }
        .glass-card {
          background: rgba(255,255,255,0.85);
          border-radius: 20px;
          box-shadow: 0 8px 32px 0 rgba(84,97,207,0.12);
          backdrop-filter: blur(8px);
          border: 1.5px solid #e3e8ee;
        }
      `}</style>

      {/* ✅ ปุ่มด้านบน */}
      <div className="container d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <button className="btn btn-success" onClick={() => setShowAddModal(true)}>
          ➕ เพิ่มพนักงานทดลองงาน
        </button>

        <button className="btn btn-outline-success" onClick={handleDownloadExcel}>
          <FaFileExcel className="me-2" />
          ดาวน์โหลด Excel
        </button>
      </div>

      {/* ✅ ตาราง */}
      <div className="container glass-card p-4 p-md-5 shadow-lg">
        <h2 className="text-center fw-bold mb-4" style={{ color: "#5461cf", letterSpacing: 1 }}>
          <span style={{ fontSize: 32 }}>📝</span> ผลการประเมินทดลองงาน
        </h2>

        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
          <input
            type="search"
            className="form-control form-control-lg shadow-sm"
            placeholder="🔍 ค้นหาชื่อ/รหัสพนักงาน"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
                  <td colSpan={8} className="text-muted py-4">
                    ⏳ กำลังโหลด...
                  </td>
                </tr>
              ) : filtered.length > 0 ? (
                filtered.map((e) => (
                  <tr key={e.id}>
                    <td>{e.id}</td>
                    <td>{e.probation_id}</td>
                    <td>{e.employee_id}</td>
                    <td>{e.employee_name}</td>
                    <td>
                      {e.role === "manager"
                        ? "หัวหน้า"
                        : e.role === "hr"
                        ? "HR"
                        : e.role || "-"}
                    </td>
                    <td>{e.comment || <span className="text-muted">-</span>}</td>
                    <td>
                      {e.evaluation_time
                        ? new Date(e.evaluation_time).toLocaleString()
                        : "-"}
                    </td>
                    <td>
                      {e.comment || e.status === "Completed" ? (
                        <span className="badge bg-success">เสร็จสิ้น</span>
                      ) : (
                        <span className="badge bg-warning text-dark">รอดำเนินการ</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-muted py-4">
                    <img
                      src="https://cdn-icons-png.flaticon.com/512/4076/4076549.png"
                      alt="empty"
                      style={{ width: 80, opacity: 0.5 }}
                    />
                    <div className="mt-3">ไม่พบข้อมูล</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ✅ Modal เพิ่มพนักงาน */}
      {showAddModal && (
        <div className="modal d-block bg-dark bg-opacity-50">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header">
                <h5 className="modal-title">➕ เพิ่มพนักงานทดลองงาน</h5>
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

                <input type="date" className="form-control mb-2" value={startDate} onChange={e => setStartDate(e.target.value)} />
                <input type="date" className="form-control mb-2" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>❌ ยกเลิก</button>
                <button className="btn btn-primary" onClick={handleAddEmployee}>✅ บันทึก</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProbationPage;
