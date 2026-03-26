# AI早报网站

AI行业热点每日推送，专为抖音AI口播创作者设计。

## 数据来源

| 源 | 类型 | 可信度 |
|---|---|---|
| Solidot | 中文硬核科技 | ⭐⭐⭐⭐⭐ |
| Hacker News | 海外开发者讨论 | ⭐⭐⭐⭐⭐ |
| The Decoder | AI深度报道 | ⭐⭐⭐⭐⭐ |
| Hugging Face Blog | 开源模型/工具 | ⭐⭐⭐⭐⭐ |
| GitHub Trending | 热门AI项目 | ⭐⭐⭐⭐⭐ |
| 少数派 | 中文科技媒体 | ⭐⭐⭐ |

## 自动化流程

- **抓取时间**: 每天 06:07 (UTC+8)
- **推送时间**: 每天 09:07 (UTC+8)
- **数据文件**: `data/ai-news-daily.json`

## 本地开发

```bash
# 安装依赖
pip install requests

# 手动运行抓取
python scripts/fetch-news.py

# 启动前端
cd web
npm install
npm run dev
```

## GitHub Actions 设置

1. 创建 GitHub 仓库
2. 推送代码到仓库
3. 在 Settings → Actions → General → Workflow permissions 中启用 "Read and write permissions"
4. 工作流会自动每天 06:07 运行

## 数据格式

```json
{
  "date": "2026-03-26",
  "generated_at": "2026-03-26T06:07:00",
  "count": 15,
  "cards": [
    {
      "id": "1",
      "title": "新闻标题",
      "what": "发生了什么",
      "why": "为什么火",
      "publicView": "大众观点",
      "counterView": "反常识认知",
      "related": ["相关热点"],
      "heat": "high/medium/low",
      "source": "来源",
      "icon": "🇨🇳/🌍"
    }
  ]
}
```
