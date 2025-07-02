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

	// โหลด .env เฉพาะตอนรันในเครื่องเรา (ไม่โหลดใน Railway)
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

	app := fiber.New()
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept",
	}))
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
	app.Get("/api/employee-confirm/:id", ConfirmEmployee)
	app.Post("/api/update-document-url", UpdateDocumentURL)
	app.Get("/api/evaluations", GetAllEvaluations)
	app.Get("/api/pending-probation", GetPendingProbationFeedback)
	app.Post("/api/probation-feedback", SubmitProbationFeedback)
	log.Println("🚀 Server is running at http://localhost:3000")
	app.Listen(":3000")
}
