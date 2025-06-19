package main

import (
	"database/sql"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq" // PostgreSQL driver
)

var db *sql.DB

func main() {
	var err error

	err = godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}
	connStr := os.Getenv("SUPABASE_DB_URL")
	if connStr == "" {
		log.Fatal("ก environment variable is not set")
	}

	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Failed to connect to Supabase:", err)
	}
	defer db.Close()

	err = db.Ping()
	if err != nil {
		log.Println("read", err)
		log.Fatal("Failed to connect to Supabase:", err)
	}

	app := fiber.New()
	app.Post("/api/upload", UploadExcel)
	app.Get("/api/history", GetLeaveHistory)
	app.Get("/api/warning", GetLeaveHistory)

	log.Println("🚀 Server is running at http://localhost:3000")
	app.Listen(":3000")
}
