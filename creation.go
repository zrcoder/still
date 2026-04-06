package main

import (
	"github.com/zrcoder/still/db"
	"github.com/zrcoder/still/model"
)

func (a *App) LoadCreations(page, pageSize int) (*model.PaginatedResult, error) {
	creations, total, err := db.LoadCreations(page, pageSize)
	if err != nil {
		return nil, err
	}
	return model.PaginatedSlice(creations, total, page, pageSize), nil
}

func (a *App) SaveCreation(content string) (*model.Creation, error) {
	id, createdAt, err := db.SaveCreation(content)
	if err != nil {
		return nil, err
	}

	return &model.Creation{
		ID:        id,
		Content:   content,
		CreatedAt: createdAt,
	}, nil
}
