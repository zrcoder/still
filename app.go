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
		Description: "新学期发了书，闻着油墨味儿阅读，不认识的字也很美",
	},
	{
		Title:       "窑█",
		FullTitle:   "窑洞",
		Description: "冬暖夏凉，墙壁上挂着干辣椒。",
	},
	{
		Title:       "█壑",
		FullTitle:   "沟壑",
		Description: "雨水冲出的道道伤痕，像大字，也像甲骨。",
	},
	{
		Title:       "█垯",
		FullTitle:   "圪垯",
		Description: "踩上去咔嚓一声碎开，像踩碎一个字。",
	},
	{
		Title:       "█面",
		FullTitle:   "荞面",
		Description: "荞麦磨的，黑黑的。做成的面条叫饸饹。",
	},
	{
		Title:       "█垛",
		FullTitle:   "麦垛",
		Description: "麻雀落在上头，叽叽喳喳像在聊天。",
	},
	{
		Title:       "糜█",
		FullTitle:   "糜子",
		Description: "穗子垂着头，像认错的娃娃。",
	},
	{
		Title:       "█裂",
		FullTitle:   "皲裂",
		Description: "手背上的口子，一到冬天就开裂，渗出血丝。",
	},
	{
		Title:       "█蜚",
		FullTitle:   "蜚蜚",
		Description: "灶台上的飞蛾，扑火的时候，翅膀扑棱棱响。",
	},
	{
		Title:       "█笔",
		FullTitle:   "铅笔",
		Description: "用到很短很短，舍不得扔。",
	},
	{
		Title:       "█晖",
		FullTitle:   "夕晖",
		Description: "太阳落山时，满天红彤彤。照在土墙上，像贴了一层金。",
	},
	{
		Title:       "█烟",
		FullTitle:   "炊烟",
		Description: "从窑顶的烟囱冒出，歪歪扭扭，飘向崖顶。",
	},
	{
		Title:       "█风",
		FullTitle:   "朔风",
		Description: "冬天的风，刺骨地冷。呜呜地响，像狼。",
	},
	{
		Title:       "█院",
		FullTitle:   "土院",
		Description: "围墙是土夯的，墙根长着狗尾巴草，开着小黄花。",
	},
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
