package main

import (
	"database/sql"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq" // PostgreSQL driver
)

var db *sql.DB

func main() {
	var err error

	// โหลด .env เฉพาะตอนรันในเครื่องเรา (ไม่โหลดใน production)
	if os.Getenv("RAILWAY_ENVIRONMENT") == "" {
		if err := godotenv.Load(); err != nil {
			log.Println("⚠️ Warning: ไม่พบไฟล์ .env (อาจจะรันบน production อยู่)")
		}
	}

	connStr := os.Getenv("SUPABASE_DB_URL")
	if connStr == "" {
		log.Fatal("❌ Environment variable SUPABASE_DB_URL is not set")
	}

	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("❌ Failed to connect to Supabase:", err)
	}
	defer db.Close()

	err = db.Ping()
	if err != nil {
		log.Fatal("❌ Failed to connect to Supabase:", err)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	app := fiber.New()
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept",
	}))

	app.Get("/api/createpass", createpass)

	app.Post("/api/login", Login)
	app.Post("/api/update-warning", UpdateWarningStatus)
	app.Post("/api/upload", UploadExcel)
	app.Get("/api/history", GetLeaveHistory)
	app.Get("/api/emails", GetAllEmployeeEmails)
	app.Post("/api/employees", addEmployee)
	app.Get("/api/warning", GetWarning)
	app.Get("/api/summary", GetSummary)
	// ฝั่งหน้า employee
	app.Get("/api/sites", GetSites)
	app.Get("/api/meta-options", GetPositionsAndDepartments)

	app.Post("/api/add-employee", addEmployee)
	app.Get("/api/document", GetStartDocuments)
	app.Post("/api/update-boolean", UpdateBooleanField)

	app.Get("/api/sendEmailWithSendGridTemplate", SendProbationReminder)
	//app.Get("/api/test", SendTestProbationEmail)
	app.Get("/api/employee-confirm/:id", ConfirmEmployee)
	app.Post("/api/update-document-url", UpdateDocumentURL)
	app.Get("/api/evaluations", GetAllEvaluations)

	app.Get("/api/pending-probation", GetPendingProbationFeedback)
	app.Post("/api/probation-feedback", SubmitProbationFeedback)

	log.Printf("🚀 Server is running on 0.0.0.0:%s\n", port)
	// bind ที่ 0.0.0.0 เพื่อให้รับ request จากภายนอกได้ (สำคัญมาก)
	err = app.Listen("0.0.0.0:" + port)
	if err != nil {
		log.Fatal("❌ Failed to start server:", err)
	}
}
