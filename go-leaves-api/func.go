package main

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/xuri/excelize/v2"
)

type LeaveRecord struct {
	EmployeeID int
	Email      string
	StartDate  string
	EndDate    string
	LeaveType  string
	Site       string
}

type LeaveHistory struct {
	ID            int    `json:"id"`
	EmployeeID    int    `json:"employee_id"`
	EmployeeName  string `json:"employee_name"`
	EmployeeEmail string `json:"employee_email"`
	StartDate     string `json:"start_date"`
	EndDate       string `json:"end_date"`
	LeaveTypeName string `json:"leave_type_name"`
	Approved      bool   `json:"approved"`
	RemainingDays int    `json:"remaining_leave_days"`
	Site          string `json:"site"`
}

func GetLeaveHistory(c *fiber.Ctx) error {
	query := `
		SELECT 
			lh.รหัสลา,
			lh.fk_รหัสพนักงาน,
			e.ชื่อ_นามสกุล,
			e.email,
			s.ชื่อsite,
			lh.วันที่เริ่มลา,
			lh.วันที่สิ้นสุดการลา,
			lt.ชื่อประเภท,

			lh."เหลือวันลาอีกกี่วัน"

		FROM "ประวัติการลา" lh
		LEFT JOIN "ประเภทของแต่ละลาหยุด" lt ON lh.ประเภทการลา = lt.รหัสโค้ดลำดับ
		JOIN พนักงาน e ON lh.fk_รหัสพนักงาน = e.รหัสพนักงาน
		JOIN site s ON e.fk_รหัสsite = s.รหัสsite
		ORDER BY lh.รหัสลา
	`

	rows, err := db.Query(query)
	if err != nil {
		fmt.Println("Error fetching leave history:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch leave history"})
	}
	defer rows.Close()

	var results []LeaveHistory

	for rows.Next() {
		var lh LeaveHistory
		err := rows.Scan(
			&lh.ID,
			&lh.EmployeeID,
			&lh.EmployeeName,
			&lh.EmployeeEmail,
			&lh.Site,
			&lh.StartDate,
			&lh.EndDate,
			&lh.LeaveTypeName,
			&lh.RemainingDays,
		)
		if err != nil {
			fmt.Println("Error scanning row:", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to read leave history data"})
		}
		results = append(results, lh)
	}

	return c.JSON(results)
}
func UploadExcel(c *fiber.Ctx) error {
	log.Println("✅เริ่มอัปโหลดไฟล์ Excel")
	fileHeader, err := c.FormFile("file")
	if err != nil {
		log.Println("❌ไม่พบไฟล์ที่อัปโหลด:", err)
		return c.Status(400).SendString("ไม่พบไฟล์ที่อัปโหลด")
	}
	log.Println("✅ชื่อไฟล์ที่อัปโหลด:", fileHeader.Filename)
	file, err := fileHeader.Open()
	if err != nil {
		log.Println("❌เปิดไฟล์ไม่สำเร็จ:", err)
		return c.Status(500).SendString("ไม่สามารถเปิดไฟล์ได้")
	}
	defer file.Close()
	log.Println("✅เปิดไฟล์สำเร็จ:", fileHeader.Filename)
	f, err := excelize.OpenReader(file)
	if err != nil {
		log.Println("❌อ่านไฟล์ Excel ไม่ได้:", err)
		return c.Status(500).SendString("ไม่สามารถอ่านไฟล์ Excel ได้")
	}
	log.Println("✅อ่านไฟล์ Excel สำเร็จ:", fileHeader.Filename)
	sheet := f.GetSheetName(0)
	rows, err := f.GetRows(sheet)
	if err != nil {
		log.Println("❌อ่านข้อมูล sheet ไม่ได้:", err)
		return c.Status(500).SendString("ไม่สามารถอ่านข้อมูล sheet ได้")
	}

	log.Println("✅อ่านข้อมูลจาก sheet สำเร็จ:", sheet)
	for i, row := range rows {
		if i == 0 {
			continue
		}
		rowNumber := i + 1

		if len(row) < 5 {
			return c.Status(400).SendString(fmt.Sprintf("❌แถวที่ %d มีข้อมูลไม่ครบ 5 คอลัมน์", rowNumber))
		}

		email := row[0]
		startDate := row[1]
		endDate := row[2]
		leaveType := row[3]
		site := row[4]

		startDateParsed, err := tryParseDate(startDate)
		if err != nil {
			return c.Status(400).SendString(fmt.Sprintf("❌แถวที่ %d: วันที่เริ่มลาไม่ถูกต้อง (%s)", rowNumber, err))
		}
		endDateParsed, err := tryParseDate(endDate)
		if err != nil {
			return c.Status(400).SendString(fmt.Sprintf("❌แถวที่ %d: วันที่สิ้นสุดการลาไม่ถูกต้อง (%s)", rowNumber, err))
		}

		startDateStr := startDateParsed.Format("2006-01-02")
		endDateStr := endDateParsed.Format("2006-01-02")

		var empID int
		err = db.QueryRow(`SELECT รหัสพนักงาน FROM พนักงาน WHERE email = $1`, email).Scan(&empID)
		if err != nil {
			return c.Status(400).SendString(fmt.Sprintf("❌แถวที่ %d: ไม่พบอีเมล %s ในระบบ", rowNumber, email))
		}

		var startWorkingDate time.Time
		err = db.QueryRow(`SELECT วันที่เริ่มทำงาน FROM พนักงาน WHERE รหัสพนักงาน = $1`, empID).Scan(&startWorkingDate)
		if err != nil {
			return c.Status(500).SendString(fmt.Sprintf("❌แถวที่ %d: ไม่สามารถดึงวันที่เริ่มทำงานของพนักงาน %d", rowNumber, empID))
		}

		yearsOfService := startDateParsed.Year() - startWorkingDate.Year()
		if startDateParsed.YearDay() < startWorkingDate.YearDay() {
			yearsOfService--
		}

		var baseLeave int
		err = db.QueryRow(`SELECT "จำนวนวัน" FROM "ประเภทของแต่ละลาหยุด" WHERE ชื่อประเภท = $1`, leaveType).Scan(&baseLeave)
		if err != nil {
			return c.Status(400).SendString(fmt.Sprintf("❌แถวที่ %d: ไม่พบประเภทการลา %s", rowNumber, leaveType))
		}

		if site == "Office" || site == "Site1" {
			baseLeave += yearsOfService
		}

		var usedLeaveDays int
		err = db.QueryRow(`
			SELECT COALESCE(SUM(DATE_PART('day', วันที่สิ้นสุดการลา::timestamp - วันที่เริ่มลา::timestamp) + 1), 0)
			FROM "ประวัติการลา"
			WHERE fk_รหัสพนักงาน = $1
			AND ประเภทการลา = (SELECT รหัสโค้ดลำดับ FROM "ประเภทของแต่ละลาหยุด" WHERE ชื่อประเภท = $2)
			AND EXTRACT(YEAR FROM วันที่เริ่มลา) = $3
		`, empID, leaveType, startDateParsed.Year()).Scan(&usedLeaveDays)
		if err != nil {
			return c.Status(500).SendString(fmt.Sprintf("❌แถวที่ %d: ไม่สามารถดึงจำนวนวันลาที่ใช้ไปแล้วของพนักงาน %d", rowNumber, empID))
		}

		currentLeave := int(endDateParsed.Sub(startDateParsed).Hours()/24) + 1
		remaining := baseLeave - usedLeaveDays - currentLeave
		var data int
		_, err = db.Exec(`
			INSERT INTO "ประวัติการลา"
			(fk_รหัสพนักงาน, วันที่เริ่มลา, วันที่สิ้นสุดการลา, ประเภทการลา, "เหลือวันลาอีกกี่วัน")
			VALUES ($1, $2, $3,
				(SELECT รหัสโค้ดลำดับ FROM "ประเภทของแต่ละลาหยุด" WHERE ชื่อประเภท = $4),
				 $5
			)
		`, empID, startDateStr, endDateStr, leaveType, remaining)
		if err != nil {
			return c.Status(500).SendString(fmt.Sprintf("❌แถวที่ %d: ไม่สามารถบันทึกลงฐานข้อมูล: %v", rowNumber, err))
		}
		data++
		log.Printf("✅บันทึกแถวที่ %d ของรหัส %d เรียบร้อย\n", data, empID)
	}
	//err
	log.Println("✅อัปโหลดไฟล์ Excel สำเร็จ:", fileHeader.Filename)
	_ = GetWarning(c)
	return c.Status(200).SendString("✅อัปโหลดไฟล์ Excel สำเร็จ")
}
func GetWarning(c *fiber.Ctx) error {
	type WarningUser struct {
		WarningID    int    `json:"warningID"`
		EmployeeID   int    `json:"EmployeeID"`
		EmployeeName string `json:"EmployeeName"`
		Email        string `json:"Email"`
		Remaining    int    `json:"Remaining"`
		LeaveType    string `json:"LeaveType"`
	}

	rows, err := db.Query(`
		SELECT lh.รหัสลา, e.รหัสพนักงาน, e.ชื่อ_นามสกุล, e.email, lh."เหลือวันลาอีกกี่วัน", t.ชื่อประเภท
		FROM "ประวัติการลา" lh
		JOIN "ประเภทของแต่ละลาหยุด" t ON t.รหัสโค้ดลำดับ = lh.ประเภทการลา
		JOIN พนักงาน e ON lh.fk_รหัสพนักงาน = e.รหัสพนักงาน
		WHERE lh."เหลือวันลาอีกกี่วัน" < 0 AND lh.เตือน = false
	`)
	if err != nil {
		return c.Status(500).SendString("❌ ไม่สามารถดึงข้อมูลพนักงานที่เหลือวันลาติดลบ")
	}
	defer rows.Close()

	var warnings []WarningUser
	for rows.Next() {
		var u WarningUser
		if err := rows.Scan(&u.WarningID, &u.EmployeeID, &u.EmployeeName, &u.Email, &u.Remaining, &u.LeaveType); err == nil {
			warnings = append(warnings, u)
		}
	}

	return c.JSON(warnings)
}

func tryParseDate(dateStr string) (time.Time, error) {
	formats := []string{"02-Jan-06", "2-Jan-06", "2-Jan-2006", "02-Jan-2006"}
	for _, format := range formats {
		if t, err := time.Parse(format, dateStr); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("invalid date format: %s", dateStr)
}
func GetSummary(c *fiber.Ctx) error {
	month := c.Query("month")
	year := c.Query("year")
	fmt.Println("Month:", month, "Year:", year)

	var rows *sql.Rows
	var err error

	if month == "" {
		// ถ้าไม่ส่ง month ให้สรุปทั้งปี
		rows, err = db.Query(`
			SELECT e.รหัสพนักงาน,e.ชื่อ_นามสกุล,
				COALESCE(SUM((l.วันที่สิ้นสุดการลา::date - l.วันที่เริ่มลา::date) + 1), 0) AS total_days,
				COALESCE(SUM(CASE WHEN t.ชื่อประเภท = 'Sick Leave' THEN (l.วันที่สิ้นสุดการลา::date - l.วันที่เริ่มลา::date) + 1 ELSE 0 END), 0) AS sick_days,
				COALESCE(SUM(CASE WHEN t.ชื่อประเภท = 'Vacation Leave' THEN (l.วันที่สิ้นสุดการลา::date - l.วันที่เริ่มลา::date) + 1 ELSE 0 END), 0) AS vacation_days,
				COALESCE(SUM(CASE WHEN t.ชื่อประเภท = 'Business Leave' THEN (l.วันที่สิ้นสุดการลา::date - l.วันที่เริ่มลา::date) + 1 ELSE 0 END), 0) AS business_days
			FROM "ประวัติการลา" l
			JOIN พนักงาน e ON e.รหัสพนักงาน = l.fk_รหัสพนักงาน
			JOIN "ประเภทของแต่ละลาหยุด" t ON t.รหัสโค้ดลำดับ = l.ประเภทการลา
			WHERE EXTRACT(YEAR FROM l.วันที่เริ่มลา) = $1
			GROUP BY e.รหัสพนักงาน,e.ชื่อ_นามสกุล
		`, year)
	} else {
		// ถ้ามี month ให้สรุปเฉพาะเดือนนั้น
		rows, err = db.Query(`
			SELECT  e.รหัสพนักงาน,e.ชื่อ_นามสกุล,
				COALESCE(SUM((l.วันที่สิ้นสุดการลา::date - l.วันที่เริ่มลา::date) + 1), 0) AS total_days,
				COALESCE(SUM(CASE WHEN t.ชื่อประเภท = 'Sick Leave' THEN (l.วันที่สิ้นสุดการลา::date - l.วันที่เริ่มลา::date) + 1 ELSE 0 END), 0) AS sick_days,
				COALESCE(SUM(CASE WHEN t.ชื่อประเภท = 'Vacation Leave' THEN (l.วันที่สิ้นสุดการลา::date - l.วันที่เริ่มลา::date) + 1 ELSE 0 END), 0) AS vacation_days,
				COALESCE(SUM(CASE WHEN t.ชื่อประเภท = 'Business Leave' THEN (l.วันที่สิ้นสุดการลา::date - l.วันที่เริ่มลา::date) + 1 ELSE 0 END), 0) AS business_days
			FROM "ประวัติการลา" l
			JOIN พนักงาน e ON e.รหัสพนักงาน = l.fk_รหัสพนักงาน
			JOIN "ประเภทของแต่ละลาหยุด" t ON t.รหัสโค้ดลำดับ = l.ประเภทการลา
			WHERE EXTRACT(MONTH FROM l.วันที่เริ่มลา) = $1 AND EXTRACT(YEAR FROM l.วันที่เริ่มลา) = $2
			GROUP BY  e.รหัสพนักงาน,e.ชื่อ_นามสกุล
		`, month, year)
	}

	if err != nil {
		log.Println("❌ Error executing query:", err.Error())
		return c.Status(500).JSON(fiber.Map{
			"error": err,
		})
	}
	defer rows.Close()

	type Summary struct {
		EmployeeID   int    `json:"employee_id"`
		EmployeeName string `json:"employee_name"`
		TotalDays    int    `json:"total_days"`
		SickDays     int    `json:"sick_days"`
		VacationDays int    `json:"vacation_days"`
		BusinessDays int    `json:"business_days"`
	}
	var results []Summary
	for rows.Next() {
		var s Summary
		if err := rows.Scan(&s.EmployeeID, &s.EmployeeName, &s.TotalDays, &s.SickDays, &s.VacationDays, &s.BusinessDays); err == nil {
			results = append(results, s)
		}
	}

	return c.JSON(results)
}

type StartDocument struct {
	ID                       int            `json:"id"`
	EmployeeID               int            `json:"employee_id"`
	EmployeeName             string         `json:"employee_name"`
	EmployeeEmail            string         `json:"employee_email"`
	IDCardCopy               sql.NullString `json:"id_card_copy"`
	HouseRegistration        sql.NullString `json:"house_registration"`
	Transcript               sql.NullString `json:"transcript"`
	BankAccount              sql.NullString `json:"bank_account"`
	Photo                    sql.NullString `json:"photo"`
	PersonalDataFile         sql.NullString `json:"personal_data_file"`
	EmploymentContract       sql.NullString `json:"employment_contract"`
	ContractSigned           sql.NullBool   `json:"contract_signed"`
	PersonalDataAcknowledged sql.NullBool   `json:"personal_data_acknowledged"`
	SocialSecurityRegistered sql.NullBool   `json:"social_security_registered"`
	WelcomeEmailSent         sql.NullBool   `json:"welcome_email_sent"`
	WelcomeEmailDate         sql.NullTime   `json:"welcome_email_date"`
	EmployeeReplied          sql.NullBool   `json:"employee_replied"`
	ReplyDate                sql.NullTime   `json:"reply_date"`
}

func GetPositionsAndDepartments(c *fiber.Ctx) error {
	type Result struct {
		Position   string `json:"position"`
		Department string `json:"department"`
	}
	var positions []string
	var departments []string

	// ดึงตำแหน่งไม่ซ้ำ
	rows, err := db.Query(`SELECT DISTINCT ตำแหน่ง FROM พนักงาน WHERE ตำแหน่ง IS NOT NULL`)
	if err != nil {
		return c.Status(500).SendString("❌ ดึงตำแหน่งล้มเหลว")
	}
	defer rows.Close()
	for rows.Next() {
		var pos string
		rows.Scan(&pos)
		positions = append(positions, pos)
	}

	// ดึงแผนกไม่ซ้ำ
	rows2, err := db.Query(`SELECT DISTINCT แผนก FROM พนักงาน WHERE แผนก IS NOT NULL`)
	if err != nil {
		return c.Status(500).SendString("❌ ดึงแผนกล้มเหลว")
	}
	defer rows2.Close()
	for rows2.Next() {
		var dept string
		rows2.Scan(&dept)
		departments = append(departments, dept)
	}

	return c.JSON(fiber.Map{
		"positions":   positions,
		"departments": departments,
	})
}

func GetStartDocuments(c *fiber.Ctx) error {
	rows, err := db.Query(`
		SELECT 
			d.รหัส AS id,
			d.รหัสพนักงาน AS employee_id,
			e.ชื่อ_นามสกุล AS employee_name,
			e.email AS employee_email,
			d.สำเนาบัตรประชาชน AS id_card_copy,
			d.ทะเบียนบ้าน AS house_registration,
			d.Transcript AS transcript,
			d.บัญชีธนาคาร AS bank_account,
			d.รูปถ่าย AS photo,
			d.ไฟล์ข้อมูลส่วนบุคคล AS personal_data_file,
			d.สัญญาจ้าง AS employment_contract,
			d.เซ็นสัญญาแล้ว AS contract_signed,
			d.รับทราบ_พรบ_ข้อมูล AS personal_data_acknowledged,
			d.ลงทะเบียนประกันสังคม AS social_security_registered,
			d.ส่งอีเมลต้อนรับแล้ว AS welcome_email_sent,
			d.วันที่ส่งอีเมล AS welcome_email_date,
			d.พนักงานตอบกลับแล้ว AS employee_replied,
			d.วันที่ตอบกลับ AS reply_date
		FROM เอกสารพนักงาน d JOIN พนักงาน e ON e.รหัสพนักงาน =d.รหัสพนักงาน ORDER BY รหัส
	`)
	if err != nil {
		log.Println("❌ ไม่สามารถดึงข้อมูลเอกสาร:", err)
		return c.Status(500).SendString("❌ ไม่สามารถดึงข้อมูลเอกสาร")
	}
	defer rows.Close()

	var documents []StartDocument
	for rows.Next() {
		var doc StartDocument
		if err := rows.Scan(
			&doc.ID,
			&doc.EmployeeID,
			&doc.EmployeeName,
			&doc.EmployeeEmail,
			&doc.IDCardCopy,
			&doc.HouseRegistration,
			&doc.Transcript,
			&doc.BankAccount,
			&doc.Photo,
			&doc.PersonalDataFile,
			&doc.EmploymentContract,
			&doc.ContractSigned,
			&doc.PersonalDataAcknowledged,
			&doc.SocialSecurityRegistered,
			&doc.WelcomeEmailSent,
			&doc.WelcomeEmailDate,
			&doc.EmployeeReplied,
			&doc.ReplyDate,
		); err != nil {
			log.Println("❌ ดึงข้อมูลล้มเหลวที่ row.Scan():", err)
			return c.Status(500).SendString("❌ ดึงข้อมูลล้มเหลวที่ row.Scan()")
		}
		documents = append(documents, doc)
	}

	return c.JSON(documents)
}

type UpdateDocURL struct {
	EmployeeID int    `json:"employee_id"`
	Field      string `json:"field"`
	URL        string `json:"url"`
}

func UpdateDocumentURL(c *fiber.Ctx) error {
	var payload UpdateDocURL
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(400).SendString("❌ ข้อมูลไม่ถูกต้อง")
	}
	log.Printf("✅ อัปเดตเอกสารสำหรับพนักงาน %d, ฟิลด์: %s, URL: %s\n", payload.EmployeeID, payload.Field, payload.URL)
	query := fmt.Sprintf(`UPDATE เอกสารพนักงาน SET %s = $1 WHERE รหัสพนักงาน = $2`, payload.Field)

	if _, err := db.Exec(query, payload.URL, payload.EmployeeID); err != nil {
		log.Println("❌ อัปเดตลิงก์ล้มเหลว:", err)
		return c.Status(500).SendString("❌ อัปเดตไม่สำเร็จ")
	}

	return c.SendString("✅ อัปเดตลิงก์สำเร็จ")
}
func ConfirmEmployee(c *fiber.Ctx) error {
	id := c.Params("id")
	fmt.Println("✅ ยืนยันพนักงาน ID:", id)
	_, err := db.Exec(`UPDATE เอกสารพนักงาน SET พนักงานตอบกลับแล้ว = true, วันที่ตอบกลับ = CURRENT_TIMESTAMP WHERE รหัสพนักงาน = $1`, id)
	if err != nil {
		return c.Status(500).SendString("❌ ยืนยันล้มเหลว")
	}
	return c.SendString("✅ ยืนยันสำเร็จ ขอบคุณที่ตอบกลับ")
}

func addEmployee(c *fiber.Ctx) error {
	type Employee struct {
		Name       string `json:"name"`
		Email      string `json:"email"`
		Site       string `json:"site"`
		Position   string `json:"position"`
		Department string `json:"department"`
		Boss       *int   // ใช้ pointer int เพราะจะเก็บรหัสหัวหน้าได้ หรือ nil
	}

	var emp Employee
	if err := c.BodyParser(&emp); err != nil {
		fmt.Println("❌ ข้อมูลไม่ถูกต้อง:", err)
		return c.Status(400).SendString("❌ ข้อมูลไม่ถูกต้อง")
	}
	fmt.Println("✅ ข้อมูลพนักงาน:", emp)

	if !strings.Contains(emp.Position, "หัวหน้า") {
		err := db.QueryRow(`SELECT รหัสพนักงาน FROM พนักงาน WHERE ตำแหน่ง ILIKE '%หัวหน้า%' and แผนก = $1`, emp.Department).Scan(&emp.Boss)
		if err != nil {
			fmt.Println("❌ ไม่พบหัวหน้า:", err)
			return c.Status(400).SendString("❌ ไม่พบหัวหน้าที่ระบุ")
		}
	} else {
		emp.Boss = nil
	}

	// 🔻 ดึงค่ารหัสสูงสุดแล้ว +1
	var nextID int
	err := db.QueryRow(`SELECT COALESCE(MAX(รหัสพนักงาน), 1000) + 1 FROM พนักงาน`).Scan(&nextID)
	if err != nil {
		fmt.Println("❌ ไม่สามารถคำนวณรหัสใหม่:", err)
		return c.Status(500).SendString("❌ ไม่สามารถคำนวณรหัสใหม่")
	}

	// 🔻 insert แบบกำหนดรหัสเอง
	_, err = db.Exec(`
		INSERT INTO พนักงาน 
		(รหัสพนักงาน, ชื่อ_นามสกุล, email, fk_รหัสsite, ตำแหน่ง, แผนก, วันที่เริ่มทำงาน, หัวหน้า)
		VALUES ($1, $2, $3, (SELECT รหัสsite FROM site WHERE ชื่อsite = $4), $5, $6, NOW(), $7)
	`, nextID, emp.Name, emp.Email, emp.Site, emp.Position, emp.Department, emp.Boss)
	if err != nil {
		fmt.Println("❌ เพิ่มพนักงานล้มเหลว:", err)
		return c.Status(500).SendString("❌ เพิ่มพนักงานล้มเหลว")
	}
	fmt.Println("✅ เพิ่มพนักงานสำเร็จ, รหัส:", nextID)
	var Iddoc int
	err = db.QueryRow(`SELECT COALESCE(MAX(รหัส), 1000) + 1 FROM เอกสารพนักงาน`).Scan(&Iddoc)
	if err != nil {
		fmt.Println("❌ ไม่สามารถคำนวณรหัสใหม่:", err)
		return c.Status(500).SendString("❌ ไม่สามารถคำนวณรหัสใหม่")
	}
	// สร้างเอกสารว่าง
	_, err = db.Exec(`
		INSERT INTO เอกสารพนักงาน (รหัส,รหัสพนักงาน, ส่งอีเมลต้อนรับแล้ว,วันที่ส่งอีเมล) VALUES ($1,$2, TRUE,CURRENT_TIMESTAMP)
	`, Iddoc, nextID)
	if err != nil {
		fmt.Println("❌ สร้างเอกสารไม่สำเร็จ:", err)
		return c.Status(500).SendString("❌ สร้างเอกสารไม่สำเร็จ")
	}

	return c.JSON(fiber.Map{
		"employee_id":   nextID,
		"employee_name": emp.Name,
		"email":         emp.Email,
		"site":          emp.Site,
	})
}

func GetSites(c *fiber.Ctx) error {
	rows, err := db.Query(`SELECT รหัสsite, ชื่อsite FROM site`)
	if err != nil {
		fmt.Println("Error fetching sites:", err)
		return c.Status(500).JSON(fiber.Map{"error": "โหลดไซต์ล้มเหลว"})
	}
	defer rows.Close()

	var sites []map[string]string
	for rows.Next() {
		var id, name string
		rows.Scan(&id, &name)
		sites = append(sites, map[string]string{"id": id, "name": name})
	}

	return c.JSON(sites)
}

type UpdateBooleanRequest struct {
	EmployeeID int    `json:"employee_id"`
	Field      string `json:"field"`
	Value      bool   `json:"value"`
}

var allowedBooleanFields = map[string]string{
	"contract_signed":            "เซ็นสัญญาแล้ว",
	"personal_data_acknowledged": "รับทราบ_พรบ_ข้อมูล",
	"social_security_registered": "ลงทะเบียนประกันสังคม",
	"welcome_email_sent":         "ส่งอีเมลต้อนรับแล้ว",
	"employee_replied":           "พนักงานตอบกลับแล้ว",
}

func UpdateBooleanField(c *fiber.Ctx) error {
	req := new(UpdateBooleanRequest)
	if err := c.BodyParser(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ข้อมูลไม่ถูกต้อง"})
	}

	dbField, ok := allowedBooleanFields[req.Field]
	if !ok {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": fmt.Sprintf("ไม่สามารถอัปเดตฟิลด์นี้ได้: %s", req.Field)})
	}

	query := fmt.Sprintf(`UPDATE เอกสารพนักงาน SET "%s" = $1 WHERE รหัสพนักงาน = $2`, dbField)

	_, err := db.Exec(query, req.Value, req.EmployeeID)
	if err != nil {
		log.Println("❌ อัปเดต boolean ล้มเหลว:", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "อัปเดตข้อมูลล้มเหลว"})
	}

	return c.JSON(fiber.Map{"message": "อัปเดตสถานะสำเร็จ"})
}

func GetAllEmployeeEmails(c *fiber.Ctx) error {
	rows, err := db.Query(`SELECT email FROM พนักงาน WHERE email IS NOT NULL`)
	if err != nil {
		return c.Status(500).SendString("❌ ไม่สามารถดึงอีเมลพนักงาน")
	}
	defer rows.Close()

	var emails []string
	for rows.Next() {
		var email string
		if err := rows.Scan(&email); err == nil {
			emails = append(emails, email)
		}
	}
	return c.JSON(emails)
}
