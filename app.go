package main

import (
	"context"
	"fmt"
	"math/rand/v2"
	"os"
	"path/filepath"
	"time"

	"github.com/zrcoder/still/db"
	"github.com/zrcoder/still/model"
)

type App struct {
	ctx context.Context
}

var fragmentPool = []model.Fragment{
	{
		Title:       "希█",
		FullTitle:   "希望",
		Description: "像眼睛，望着他，望了很久。",
	},
	{
		Title:       "█支装",
		FullTitle:   "廿支装",
		Description: "两根竖线，下边相连。父亲说是二十的意思。",
	},
	{
		Title:       "█天",
		FullTitle:   "春天",
		Description: "新学期发书了，闻着油墨味儿阅读，即使不认识的字都富有美感",
	},
	{
		Title:       "█水",
		FullTitle:   "山水",
		Description: "弯弯曲曲的，像山，又像水。他蹲在那面墙前看了很久。",
	},
	{
		Title:       "远█",
		FullTitle:   "远方",
		Description: "不知道那远方究竟有多远，但心里会有一种说不清的跳动。",
	},
	{
		Title:       "█子",
		FullTitle:   "竹子",
		Description: "竹叶上挂着露珠，晶莹的，像字。",
	},
	{
		Title:       "█字",
		FullTitle:   "识字",
		Description: "捧着课本，一个字一个字地认，觉得认识一个字就像交到一个朋友。",
	},
	{
		Title:       "█光",
		FullTitle:   "目光",
		Description: "老师的目光落在黑板上，他跟着那个目光，看到了一个他从没去过的世界。",
	},
	{
		Title:       "电█院",
		FullTitle:   "电影院",
		Description: "只在露天电影里见过。白色的幕布撑在星空下，人影晃动，声音很远。",
	},
	{
		Title:       "█歌",
		FullTitle:   "山歌",
		Description: "村里有人唱，他听不懂词儿，只觉得那声音顺着风，传得很远。",
	},
	{
		Title:       "█念",
		FullTitle:   "信念",
		Description: "不知道这两个字是什么意思，觉得听起来有力量。",
	},
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

func (a *App) GenFragment() (*model.Fragment, error) {
	collectedSet, err := db.LoadCollectedFullTitles()
	if err != nil {
		return nil, fmt.Errorf("failed to load collected titles: %w", err)
	}
	pool := make([]model.Fragment, 0, len(fragmentPool))
	for _, frag := range fragmentPool {
		if !collectedSet[frag.FullTitle] {
			pool = append(pool, frag)
		}
	}
	if len(pool) == 0 {
		return nil, nil
	}
	seed := time.Now().UnixNano()
	rng := rand.New(rand.NewPCG(uint64(seed), uint64(seed)))
	idx := rng.IntN(len(pool))
	frag := pool[idx]
	frag.PositionX = 5 + rng.Float64()*60
	frag.PositionY = 8 + rng.Float64()*75
	frag.Angle = rng.Float64()*30 - 15
	return &frag, nil
}

func (a *App) LoadCollected() ([]model.Fragment, error) {
	return db.LoadCollected()
}

func (a *App) SaveFragment(frag model.Fragment) (int64, error) {
	return db.SaveFragment(frag)
}

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

func (a *App) ResetGame() error {
	if err := db.ClearCreations(); err != nil {
		return err
	}
	return db.ClearCollected()
}
