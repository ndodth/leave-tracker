package main

import (
	"fmt"
	"log"
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
