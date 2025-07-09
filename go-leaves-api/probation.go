package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt"
	"github.com/mailgun/mailgun-go/v4"
)

func GetAllEvaluations(c *fiber.Ctx) error {
	fmt.Println("🔍 ดึงข้อมูลผลการประเมินทั้งหมด")
	rows, err := db.Query(`
		SELECT 
			r.id,
			r.รหัสช่วงทดลองงาน,
			p.รหัสพนักงาน,
			e.ชื่อ_นามสกุล,
			r.บทบาทผู้ประเมิน,
			r.ข้อความประเมิน,
			r.เวลาส่งประเมิน,
			p.สถานะ
		FROM ตารางผลการประเมิน r
		JOIN ตารางทดลองงาน p ON r.รหัสช่วงทดลองงาน = p.id
		JOIN พนักงาน e ON p.รหัสพนักงาน = e.รหัสพนักงาน
		ORDER BY r.เวลาส่งประเมิน DESC
	`)
	if err != nil {
		log.Println("❌ ดึงข้อมูลผลการประเมินล้มเหลว:", err)
		return c.Status(500).SendString("ไม่สามารถดึงข้อมูลผลการประเมิน")
	}
	defer rows.Close()

	type Evaluation struct {
		ID             int    `json:"id"`
		ProbationID    int    `json:"probation_id"`
		EmployeeID     int    `json:"employee_id"`
		EmployeeName   string `json:"employee_name"`
		Role           string `json:"role"` // 'hr' หรือ 'manager'
		Comment        string `json:"comment"`
		EvaluationTime string `json:"evaluation_time"`
		Status         string `json:"status"`
	}

	var results []Evaluation
	for rows.Next() {
		var e Evaluation
		if err := rows.Scan(
			&e.ID,
			&e.ProbationID,
			&e.EmployeeID,
			&e.EmployeeName,
			&e.Role,
			&e.Comment,
			&e.EvaluationTime,
			&e.Status,
		); err != nil {
			log.Println("❌ scan ล้มเหลว:", err)
			continue
		}
		results = append(results, e)
	}
	return c.JSON(results)
}

func GetPendingProbationFeedback(c *fiber.Ctx) error {
	query := `
		SELECT p.id, p.รหัสพนักงาน, e.ชื่อ_นามสกุล, e.email, p.วันที่เริ่มทดลอง
		FROM ตารางทดลองงาน p
		JOIN พนักงาน e ON p.รหัสพนักงาน = e.รหัสพนักงาน
		WHERE CURRENT_DATE >= p.วันที่เริ่มทดลอง + INTERVAL '30 days'
		AND NOT EXISTS (
			SELECT 1 FROM ตารางผลการประเมิน r
			WHERE r.รหัสช่วงทดลองงาน = p.id AND r.บทบาทผู้ประเมิน = 'manager'
		)
		OR NOT EXISTS (
			SELECT 1 FROM ตารางผลการประเมิน r
			WHERE r.รหัสช่วงทดลองงาน = p.id AND r.บทบาทผู้ประเมิน = 'hr'
		)
	`

	rows, err := db.Query(query)
	if err != nil {
		return c.Status(500).SendString("ไม่สามารถดึงข้อมูล")
	}
	defer rows.Close()

	type Pending struct {
		ProbationID int    `json:"probation_id"`
		EmployeeID  int    `json:"employee_id"`
		Name        string `json:"name"`
		Email       string `json:"email"`
		StartDate   string `json:"start_date"`
	}
	var results []Pending
	for rows.Next() {
		var p Pending
		rows.Scan(&p.ProbationID, &p.EmployeeID, &p.Name, &p.Email, &p.StartDate)
		results = append(results, p)
	}
	return c.JSON(results)
}
func SubmitProbationFeedback(c *fiber.Ctx) error {
	type FeedbackInput struct {
		ProbationID int    `json:"probation_id"`
		Comment     string `json:"comment"`
	}

	// ✅ ดึงข้อมูลจาก token (middleware ต้องแปะ JWT มาก่อน)
	user := c.Locals("user").(*jwt.Token)
	claims := user.Claims.(jwt.MapClaims)

	employeeID := int(claims["employee_id"].(float64)) // JWT claims ต้อง cast จาก float64

	var input FeedbackInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).SendString("ข้อมูลไม่ถูกต้อง")
	}

	var maxID int
	err := db.QueryRow(`SELECT COALESCE(MAX(id), 0) FROM ตารางผลการประเมิน`).Scan(&maxID)
	if err != nil {
		return c.Status(500).SendString("ไม่สามารถหา id สูงสุด")
	}
	newID := maxID + 1
	var role string
	err = db.QueryRow(`SELECT ตำแหนย่ FROM พนักงาน WHERE รหัสพนักงาน = $1`, employeeID).Scan(&role)
	if err != nil {
		return c.Status(500).SendString("ไม่สามารถหาบทบาทของพนักงาน")
	}
	_, err = db.Exec(`
		INSERT INTO ตารางผลการประเมิน 
		(id, รหัสช่วงทดลองงาน, รหัสผู้ประเมิน, บทบาทผู้ประเมิน, ข้อความประเมิน, เวลาส่งประเมิน)
		VALUES ($1, $2, $3, $4, $5, current_timestamp)
	`, newID, input.ProbationID, employeeID, role, input.Comment)

	if err != nil {
		return c.Status(500).SendString("ไม่สามารถบันทึกผลการประเมิน")
	}

	// อัปเดตสถานะช่วงทดลองงาน
	_, err = db.Exec(`
		UPDATE ตารางทดลองงาน
		SET สถานะ = 'Completed'
		WHERE id = $1
	`, input.ProbationID)
	if err != nil {
		return c.Status(500).SendString("ไม่สามารถอัพเดตสถานะช่วงทดลองงาน")
	}

	return c.SendString("บันทึกผลการประเมินเรียบร้อย")
}

func SendTestProbationEmail(c *fiber.Ctx) error {
	fmt.Println("🔔 กำลังทดสอบระบบส่งอีเมลแจ้งเตือนการประเมินพนักงานช่วงทดลองงาน")

	domain := "sandbox131fede9a92b464aa20f78c15c47acce.mailgun.org"
	apiKey := os.Getenv("MAILGUN_API_KEY")
	from := "ระบบแจ้งเตือน <noreply@" + domain + ">"
	subject := "แจ้งเตือนการประเมินพนักงานช่วงทดลองงาน"

	// 🧪 ค่า test (ตั้งค่าคงที่)
	employeeName := "สมชาย ใจดี"
	startDate := "2025-06-07"
	link := "https://leave-tracker-rosy.vercel.app/assessment-feedback/999"
	toEmail := "teeranatsrikaew28@gmail.com"

	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>แจ้งเตือนการประเมิน</title>
<style>
  body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 30px auto; background: #ffffff; border: 1px solid #ddd; border-radius: 8px; }
  .header { background-color: #5461cf; color: #ffffff; padding: 20px; text-align: center; }
  .content { padding: 20px; color: #333; line-height: 1.6; font-size: 16px; }
  .button { display: inline-block; padding: 12px 24px; background-color: #28a745; color: #fff !important; text-decoration: none; font-weight: bold; border-radius: 6px; margin-top: 20px; }
  .footer { background-color: #f4f4f4; color: #777; padding: 12px; text-align: center; font-size: 13px; }
</style>
</head>
<body>
  <div class="container">
    <div class="header"><h2>📋 แจ้งเตือนประเมินพนักงาน</h2></div>
    <div class="content">
      <p>เรียนหัวหน้างาน,</p>
      <p>พนักงาน <strong>%s</strong> ที่เริ่มทดลองงานเมื่อวันที่ <strong>%s</strong> กำลังจะครบกำหนดการประเมิน</p>
      <p>กรุณาดำเนินการประเมินพนักงานท่านนี้โดยคลิกปุ่มด้านล่าง:</p>
      <p style="text-align: center;"><a href="%s" class="button" target="_blank">📄 เริ่มการประเมิน</a></p>
      <p>หากท่านได้รับอีเมลนี้โดยไม่ได้เกี่ยวข้อง กรุณาละเว้นอีเมลฉบับนี้</p>
      <p>ขอขอบคุณ,<br><strong>ระบบแจ้งเตือน Vanness Plus</strong></p>
    </div>
    <div class="footer">อีเมลนี้ถูกส่งอัตโนมัติจากระบบ กรุณาอย่าตอบกลับ</div>
  </div>
</body>
</html>
`, employeeName, startDate, link)

	mg := mailgun.NewMailgun(domain, apiKey)
	message := mailgun.NewMessage(from, subject, "", toEmail)
	message.SetHTML(html)

	ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
	defer cancel()

	fmt.Printf("📤 กำลังส่งอีเมลไปที่: %s ...\n", toEmail)
	_, _, err := mg.Send(ctx, message)
	if err != nil {
		fmt.Println("❌ ล้มเหลว:", err)
		return err
	}

	fmt.Println("✅ ส่งอีเมลทดสอบสำเร็จแล้ว!")
	return nil
}

func sendProbationReminderMailgun(employeeName, startDate, link, toEmail string) error {
	fmt.Println("🔔 ส่งอีเมลแจ้งเตือนการประเมินพนักงานช่วงทดลองงาน")
	domain := "sandbox131fede9a92b464aa20f78c15c47acce.mailgun.org" // เปลี่ยนเป็นของคุณ
	apiKey := os.Getenv("MAILGUN_API_KEY")                          // หรือใส่ key ตรงนี้ (ไม่แนะนำ)
	from := "ระบบแจ้งเตือน <noreply@" + domain + ">"                // ใช้ domain เดียวกับ sandbox
	subject := "แจ้งเตือนการประเมินพนักงานช่วงทดลองงาน"

	html := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>แจ้งเตือนการประเมิน</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 30px auto;
      background: #ffffff;
      border: 1px solid #dddddd;
      border-radius: 8px;
      overflow: hidden;
    }
    .header {
      background-color: #5461cf;
      color: #ffffff;
      padding: 20px;
      text-align: center;
    }
    .header h2 {
      margin: 0;
      font-size: 24px;
    }
    .content {
      padding: 20px;
      color: #333333;
      line-height: 1.6;
      font-size: 16px;
    }
    .content p {
      margin: 0 0 15px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #28a745;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: bold;
      border-radius: 6px;
      margin-top: 20px;
    }
    .footer {
      background-color: #f4f4f4;
      color: #777777;
      padding: 12px;
      text-align: center;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- ส่วนหัว -->
    <div class="header">
      <h2>📋 แจ้งเตือนประเมินพนักงาน</h2>
    </div>

    <!-- เนื้อหา -->
    <div class="content">
      <p>เรียนหัวหน้างาน,</p>
      <p>พนักงาน <strong>%s</strong> ที่เริ่มทดลองงานเมื่อวันที่ <strong>%s</strong> กำลังจะครบกำหนดการประเมิน</p>
      <p>กรุณาดำเนินการประเมินพนักงานท่านนี้โดยคลิกปุ่มด้านล่าง:</p>

      <p style="text-align: center;">
        <a href="%s" class="button" target="_blank">📄 เริ่มการประเมิน</a>
      </p>

      <p>หากท่านได้รับอีเมลนี้โดยไม่ได้เกี่ยวข้อง กรุณาละเว้นอีเมลฉบับนี้</p>

      <p>ขอขอบคุณ,<br><strong>ระบบแจ้งเตือน Vanness Plus</strong></p>
    </div>

    <!-- ส่วนท้าย -->
    <div class="footer">
      อีเมลนี้ถูกส่งอัตโนมัติจากระบบ กรุณาอย่าตอบกลับ
    </div>
  </div>
</body>
</html>
`, employeeName, startDate, link)

	// สร้าง client
	mg := mailgun.NewMailgun(domain, apiKey)
	fmt.Println("🔗 กำลังส่งอีเมลไปที่:", toEmail)
	// สร้างข้อความ
	message := mailgun.NewMessage(from, subject, "", toEmail)
	message.SetHTML(html)
	fmt.Println("📧 กำลังเตรียมส่งอีเมล...")

	ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
	defer cancel()
	fmt.Println("⏳ กำลังส่งอีเมล...")
	_, _, err := mg.Send(ctx, message)
	if err != nil {
		fmt.Println("❌ ส่งอีเมลล้มเหลว:", err)
		return err
	}
	fmt.Println("✅ ส่งอีเมลเรียบร้อยไปที่:", toEmail)
	return nil
}

func SendProbationReminder(c *fiber.Ctx) error {
	rows, err := db.Query(`
		SELECT p.id, p.รหัสพนักงาน, e.ชื่อ_นามสกุล, p.วันที่เริ่มทดลอง
		FROM ตารางทดลองงาน p
		JOIN พนักงาน e ON p.รหัสพนักงาน = e.รหัสพนักงาน
		WHERE CURRENT_DATE = p."เวลาส่งแจ้งเตือน"
	`)
	if err != nil {
		return c.Status(500).SendString("ไม่สามารถดึงข้อมูล probation")
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var id, empID, boss int
		var name, start, bossEmail, hrEmail, departBoss, departHr string
		rows.Scan(&id, &empID, &name, &start)
		err = db.QueryRow(`SELECT หัวหน้า FROM พนักงาน WHERE รหัสพนักงาน = $1`, empID).Scan(&boss)
		if err != nil {
			fmt.Printf("❌ ไม่สามารถหาหัวหน้าของพนักงาน %d: %v\n", empID, err)
			continue
		}
		err = db.QueryRow(`SELECT email,แผนก FROM พนักงาน WHERE รหัสพนักงาน = $1`, boss).Scan(&bossEmail, &departBoss)
		if err != nil {
			fmt.Printf("❌ ไม่สามารถหาอีเมลหัวหน้าของพนักงาน %d: %v\n", empID, err)
			continue
		}
		err = db.QueryRow(`SELECT email,แผนก FROM พนักงาน WHERE แผนก = 'ฝ่ายบุคคล' AND ตำแหน่ง = 'หัวหน้าแผนก'`).Scan(&hrEmail, &departHr)
		if err != nil {
			fmt.Printf("❌ ไม่สามารถหาอีเมลฝ่ายบุคคล: %v\n", err)
			continue
		}
		// รวมอีเมลคุณ, aranya และหัวหน้า
		toEmails := []string{
			"teeranatsrikaew28@gmail.com",
			hrEmail,
			bossEmail,
		}
		assessmentLink := fmt.Sprintf("https://leave-tracker-rosy.vercel.app/assessment-feedback/%d", id)

		for _, toEmail := range toEmails {
			err := sendProbationReminderMailgun(name, start, assessmentLink, toEmail)
			if err != nil {
				fmt.Printf("❌ ส่งอีเมลล้มเหลวให้ %s: %v\n", toEmail, err)
				continue
			}

			var maxID int
			err = db.QueryRow(`SELECT COALESCE(MAX(id), 0) FROM ตารางบันทึกการแจ้งเตือน`).Scan(&maxID)
			if err != nil {
				fmt.Printf("❌ ไม่สามารถหา id สูงสุด: %v\n", err)
				continue
			}
			newID := maxID + 1

			// ✅ หาว่าส่งหาใคร เพื่อใส่ค่าในคอลัมน์ "แจ้งไปยัง"
			var notifyTo string
			switch toEmail {
			case bossEmail:
				notifyTo = "หัวหน้าแผนก"
			case hrEmail:
				notifyTo = "HR"
			default:
				notifyTo = "ระบบ"
			}

			_, err = db.Exec(
				`INSERT INTO ตารางบันทึกการแจ้งเตือน 
		(id, รหัสพนักงาน, รหัสช่วงทดลองงาน, แจ้งไปยัง, วันที่ส่งแจ้งเตือน, หัวเรื่อง) 
		VALUES ($1, $2, $3, $4, CURRENT_DATE, $5)`,
				newID, empID, id, notifyTo, fmt.Sprintf("แจ้งเตือนประเมินพนักงาน %d", empID),
			)
			if err != nil {
				fmt.Printf("❌ บันทึกการแจ้งเตือนล้มเหลวสำหรับ %s: %v\n", toEmail, err)
				continue
			}

			fmt.Printf("✅ ส่งอีเมลไปที่ %s เรียบร้อย (แจ้งไปยัง: %s)\n", toEmail, notifyTo)
			count++
		}

	}

	return c.SendString(fmt.Sprintf("✅ ส่งแจ้งเตือนมายังคุณ %d รอบ", count))
}
