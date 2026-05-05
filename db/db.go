package db

import (
	"database/sql"
	"fmt"
	"path/filepath"

	"github.com/zrcoder/still/model"

	_ "github.com/mattn/go-sqlite3"
)

var db *sql.DB

func Init(dataDir string) error {
	dbPath := filepath.Join(dataDir, "still.db")

	dbInstance, err := sql.Open("sqlite3", "file:"+dbPath+"?_busy_timeout=5000&_foreign_keys=ON")
	if err != nil {
		return fmt.Errorf("open db failed: %w", err)
	}

	// SQLite only allows ONE writer at a time
	dbInstance.SetMaxOpenConns(1)
	dbInstance.SetMaxIdleConns(1)

	if err := dbInstance.Ping(); err != nil {
		return fmt.Errorf("ping db failed: %w", err)
	}

	db = dbInstance

	if err := createTables(); err != nil {
		return fmt.Errorf("create tables failed: %w", err)
	}

	return nil
}

func createTables() error {
	// Collected fragments table
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS collected (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			full_title TEXT NOT NULL,
			description TEXT,
			collected_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return err
	}

	// Index on full_title for filtering
	_, err = db.Exec(`CREATE INDEX IF NOT EXISTS idx_collected_full_title ON collected(full_title)`)
	if err != nil {
		return err
	}

	// Creations table
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS creations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			content TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return err
	}

	// Index on created_at for ordering
	_, err = db.Exec(`CREATE INDEX IF NOT EXISTS idx_creations_date ON creations(created_at)`)
	if err != nil {
		return err
	}

	return nil
}

// Collected Fragment operations

func LoadCollected() ([]model.Fragment, error) {
	rows, err := db.Query(`
		SELECT id, title, full_title, description, collected_at 
		FROM collected 
		ORDER BY collected_at
	`)
	if err != nil {
		return nil, fmt.Errorf("query collected failed: %w", err)
	}
	defer rows.Close()

	fragments := make([]model.Fragment, 0)
	for rows.Next() {
		var frag model.Fragment
		var collectedAt string
		if err := rows.Scan(&frag.ID, &frag.Title, &frag.FullTitle, &frag.Description, &collectedAt); err != nil {
			return nil, fmt.Errorf("scan fragment failed: %w", err)
		}
		frag.CollectedAt = collectedAt
		fragments = append(fragments, frag)
	}

	return fragments, nil
}

func LoadCollectedFullTitles() (map[string]bool, error) {
	rows, err := db.Query("SELECT full_title FROM collected")
	if err != nil {
		return nil, fmt.Errorf("query collected full_title failed: %w", err)
	}
	defer rows.Close()

	set := make(map[string]bool)
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			continue
		}
		set[t] = true
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate collected rows failed: %w", err)
	}
	return set, nil
}

func SaveFragment(frag model.Fragment) (int64, error) {
	result, err := db.Exec(`
		INSERT INTO collected (title, full_title, description) 
		VALUES (?, ?, ?)
	`, frag.Title, frag.FullTitle, frag.Description)
	if err != nil {
		return 0, fmt.Errorf("insert fragment failed: %w", err)
	}
	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("get last insert id failed: %w", err)
	}
	return id, nil
}

func ClearCollected() error {
	_, err := db.Exec("DELETE FROM collected")
	if err != nil {
		return fmt.Errorf("clear collected failed: %w", err)
	}
	return nil
}

// Creation operations

func LoadCreations(page, pageSize int) ([]model.Creation, int, error) {
	// Get total count
	var total int
	err := db.QueryRow("SELECT COUNT(*) FROM creations").Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count creations failed: %w", err)
	}

	// Get paginated results
	offset := (page - 1) * pageSize
	rows, err := db.Query(`
		SELECT id, content, created_at 
		FROM creations 
		ORDER BY id DESC 
		LIMIT ? OFFSET ?
	`, pageSize, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("query creations failed: %w", err)
	}
	defer rows.Close()

	creations := make([]model.Creation, 0)
	for rows.Next() {
		var cre model.Creation
		var createdAt sql.NullString
		if err := rows.Scan(&cre.ID, &cre.Content, &createdAt); err != nil {
			return nil, 0, fmt.Errorf("scan creation failed: %w", err)
		}
		if createdAt.Valid {
			cre.CreatedAt = createdAt.String
		}
		creations = append(creations, cre)
	}

	return creations, total, nil
}

func SaveCreation(content string) (int64, string, error) {
	var id int64
	var createdAt string
	err := db.QueryRow(
		"INSERT INTO creations (content) VALUES (?) RETURNING id, created_at",
		content,
	).Scan(&id, &createdAt)
	if err != nil {
		return 0, "", fmt.Errorf("insert creation failed: %w", err)
	}
	return id, createdAt, nil
}

func ClearCreations() error {
	_, err := db.Exec("DELETE FROM creations")
	if err != nil {
		return fmt.Errorf("clear creations failed: %w", err)
	}
	return nil
}

// Utility

func Close() error {
	if db == nil {
		return nil
	}
	return db.Close()
}
