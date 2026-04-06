package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/zrcoder/still/db"
)

type App struct {
	ctx context.Context
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	homeDir, err := os.UserHomeDir()
	if err != nil {
		fmt.Printf("Failed to get home dir: %v\n", err)
		return
	}

	dataDir := filepath.Join(homeDir, ".still_wtzn")

	if err := os.MkdirAll(dataDir, 0755); err != nil {
		fmt.Printf("Failed to create data dir: %v\n", err)
		return
	}

	if err := db.Init(dataDir); err != nil {
		fmt.Printf("Failed to init db: %v\n", err)
		return
	}
}

func (a *App) ResetGame() error {
	if err := db.ClearCreations(); err != nil {
		return err
	}
	return db.ClearCollected()
}
