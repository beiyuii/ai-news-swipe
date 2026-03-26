#!/usr/bin/env python3
"""
AI早报数据源抓取脚本 v8.0 - 全功能优化版
- 修复 what 字段抓取完整摘要
- HN评论真实整合 + Critical观点提取
- 智能标签生成（基于内容分析）
- 质量过滤 + 智能去重 + 热度排序
- 飞书推送 + 异常监控
"""

import json
import os
import re
import time
import hashlib
from datetime import datetime
from typing import List, Dict, Optional
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET

# 配置
DATA_DIR = os.environ.get("DATA_DIR", "/root/.openclaw/workspace/ai-news-swipe/data")
OUTPUT_FILE = os.path.join(DATA_DIR, "ai-news-daily.json")
HISTORY_FILE = os.path.join(DATA_DIR, "history.json")
FEISHU_WEBHOOK = os.environ.get("FEISHU_WEBHOOK", "")
os.makedirs(DATA_DIR, exist_ok=True)

# RSS源配置
RSS_SOURCES = {
    "solidot": {
        "url": "https://www.solidot.org/index.rss",
        "lang": "zh",
        "icon": "🇨🇳",
        "max_items": 6,
        "trust": 5
    },
    "sspai": {
        "url": "https://sspai.com/feed",
        "lang": "zh", 
        "icon": "✨",
        "max_items": 4,
        "trust": 3
    },
    "the_decoder": {
        "url": "https://the-decoder.com/feed/",
        "lang": "en",
        "icon": "🔍",
        "max_items": 5,
        "trust": 5
    },
    "huggingface": {
        "url": "https://huggingface.co/blog/feed.xml",
        "lang": "en",
        "icon": "🤗",
        "max_items": 4,
        "trust": 5
    }
}

# ============ 基础工具 ============

def fetch_url(url: str, headers: dict = None, timeout: int = 15) -> Optional[str]:
    if headers is None:
        headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"    [失败] {url[:50]}...: {e}")
        return None

def clean_html(html: str) -> str:
    if not html:
        return ''
    text = re.sub(r'</p>', '\n', html)
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\n\s*\n', '\n\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()

def generate_id(title: str) -> str:
    return hashlib.md5(title.lower().encode()).hexdigest()[:12]

def is_ai_related(title: str, summary: str = "") -> bool:
    ai_keywords = [
        'AI', '人工智能', '大模型', 'ChatGPT', 'Claude', 'OpenAI', 'GPT', 'LLM',
        '算法', '机器学习', '深度学习', '智能体', 'Agent', 
        '文心', '通义', '豆包', 'Kimi', '智谱', '月之暗面', '混元',
        'Midjourney', 'Stable Diffusion', 'Sora', '生成式', 'AIGC',
        '神经网络', 'Transformer', '训练', '推理', 'token', '参数',
        '人形机器人', '自动驾驶', '智能客服', 'AI芯片', 'AGI',
        'embedding', 'fine-tune', 'pretrain', 'multimodal'
    ]
    text = (title + " " + summary).lower()
    return any(kw.lower() in text for kw in ai_keywords)

def is_pr_content(title: str, summary: str = "") -> bool:
    pr_keywords = ['融资', '获得', '领投', '跟投', '估值', '亿美元', '战略合作', 
                   '宣布合作', '签署协议', '重磅发布', '隆重推出', '里程碑',
                   '荣誉入选', '荣登榜单', '行业领先']
    text = (title + " " + summary).lower()
    return any(kw in text for kw in pr_keywords)

# ============ 智能标签提取 ============

def extract_smart_tags(title: str, summary: str = "") -> List[str]:
    text = (title + " " + summary).lower()
    tags = []
    
    companies = {
        'openai': 'OpenAI', 'google': 'Google', 'anthropic': 'Anthropic',
        'meta': 'Meta', 'microsoft': 'Microsoft', 'amazon': 'Amazon',
        'nvidia': 'NVIDIA', 'apple': 'Apple', 'tesla': 'Tesla',
        'deepseek': 'DeepSeek', '通义千问': '通义', '文心一言': '文心',
        '字节': '字节', '百度': '百度', '阿里': '阿里', '腾讯': '腾讯',
        '华为': '华为', '月之暗面': '月之暗面', '智谱': '智谱AI'
    }
    
    technologies = {
        'gpt-4': 'GPT-4', 'gpt-5': 'GPT-5', 'gpt-4o': 'GPT-4o',
        'claude': 'Claude', 'llama': 'Llama', 'gemini': 'Gemini',
        'sora': 'Sora', 'dall-e': 'DALL-E', 'midjourney': 'Midjourney',
        'stable diffusion': 'SD', 'transformer': 'Transformer',
        'rag': 'RAG', 'agent': '智能体', 'embedding': 'Embedding'
    }
    
    domains = {
        'video': '视频生成', 'image': '图像生成', 'audio': '语音/音频',
        'code': '代码生成', 'security': 'AI安全', 'robot': '机器人',
        'chip': 'AI芯片', 'healthcare': '医疗AI', 'finance': '金融AI'
    }
    
    for key, tag in companies.items():
        if key in text and tag not in tags:
            tags.append(tag)
    
    for key, tag in technologies.items():
        if key in text and tag not in tags:
            tags.append(tag)
    
    for key, tag in domains.items():
        if key in text and tag not in tags:
            tags.append(tag)
    
    if not tags:
        if '开源' in text or 'open source' in text:
            tags.append('开源')
        if '模型' in text or 'model' in text:
            tags.append('大模型')
        if not tags:
            tags = ['AI趋势']
    
    return tags[:4]

# ============ Hacker News API ============

def fetch_hn_stories() -> List[Dict]:
    items = []
    queries = ["artificial intelligence", "machine learning", "OpenAI", "LLM", "GPT"]
    
    for query in queries:
        url = f"https://hn.algolia.com/api/v1/search_by_date?query={query}&tags=story&numericFilters=points>30&hitsPerPage=6"
        try:
            data = fetch_url(url)
            if data:
                parsed = json.loads(data)
                for hit in parsed.get('hits', []):
                    title = hit.get('title', '')
                    if title and is_ai_related(title):
                        items.append({
                            'id': generate_id(title),
                            'title': title,
                            'summary': f"HN {hit.get('points', 0)}赞/{hit.get('num_comments', 0)}评论",
                            'source': 'Hacker News',
                            'heat': 'high' if hit.get('points', 0) > 100 else 'medium',
                            'icon': '🌍',
                            'url': f"https://news.ycombinator.com/item?id={hit.get('objectID')}",
                            'language': 'en',
                            'hn_id': hit.get('objectID'),
                            'points': hit.get('points', 0),
                            'published_at': hit.get('created_at', ''),
                            'trust': 5
                        })
        except Exception as e:
            print(f"    [HN搜索失败] {e}")
    
    items.sort(key=lambda x: x.get('points', 0), reverse=True)
    return items[:8]

def fetch_hn_comments(story_id: str) -> List[Dict]:
    try:
        url = f"https://hn.algolia.com/api/v1/items/{story_id}"
        data = fetch_url(url)
        if data:
            item = json.loads(data)
            comments = []
            for child in item.get('children', [])[:8]:
                text = clean_html(child.get('text', ''))
                if text and len(text) > 30:
                    comments.append({
                        'text': text[:300],
                        'author': child.get('author', ''),
                        'points': child.get('points', 0)
                    })
            comments.sort(key=lambda x: x.get('points', 0), reverse=True)
            return comments[:3]
    except Exception as e:
        print(f"    [HN评论失败] {e}")
    return []

def extract_critical_view(comments: List[Dict]) -> Optional[str]:
    if not comments:
        return None
    
    critical_keywords = ['but', 'however', 'actually', 'in fact', 'contrary', 
                         'misleading', 'overhyped', 'not really', '问题在于',
                         '但实际上', '相反', '误区', '夸大', '并非如此']
    
    for comment in comments:
        text = comment['text'].lower()
        if any(kw in text for kw in critical_keywords):
            return comment['text'][:200] + "..." if len(comment['text']) > 200 else comment['text']
    
    if len(comments) > 1:
        return comments[1]['text'][:200] + "..."
    
    return None

# ============ GitHub Trending ============

def fetch_github_trending() -> List[Dict]:
    items = []
    urls = [
        "https://mshibanami.github.io/GitHubTrendingRSS/daily/python.xml",
        "https://mshibanami.github.io/GitHubTrendingRSS/daily/typescript.xml"
    ]
    
    seen = set()
    for url in urls:
        try:
            xml_data = fetch_url(url)
            if xml_data:
                root = ET.fromstring(xml_data)
                channel = root.find('channel')
                if channel is not None:
                    for item in channel.findall('item')[:4]:
                        title_elem = item.find('title')
                        desc_elem = item.find('description')
                        link_elem = item.find('link')
                        
                        if title_elem is not None and title_elem.text:
                            title = clean_html(title_elem.text)
                            if title in seen:
                                continue
                            seen.add(title)
                            
                            desc = clean_html(desc_elem.text if desc_elem is not None else '')
                            if is_ai_related(title, desc):
                                items.append({
                                    'id': generate_id(title),
                                    'title': f"GitHub热门: {title}",
                                    'summary': desc[:200] if desc else 'GitHub Trending AI项目',
                                    'source': 'GitHub Trending',
                                    'heat': 'medium',
                                    'icon': '💻',
                                    'url': link_elem.text if link_elem is not None else '',
                                    'language': 'en',
                                    'trust': 4
                                })
        except Exception as e:
            print(f"    [GitHub失败] {e}")
    
    return items[:4]

# ============ RSS源抓取 ============

def fetch_rss_source(name: str, config: Dict) -> List[Dict]:
    items = []
    try:
        xml_data = fetch_url(config['url'])
        if xml_data:
            root = ET.fromstring(xml_data)
            channel = root.find('channel') or root
            
            for item in channel.findall('.//item')[:config['max_items']]:
                title_elem = item.find('title')
                desc_elem = item.find('description') or item.find('{http://purl.org/rss/1.0/modules/content/}encoded')
                link_elem = item.find('link')
                date_elem = item.find('pubDate')
                
                if title_elem is not None and title_elem.text:
                    title = clean_html(title_elem.text)
                    
                    if config['lang'] == 'zh' and is_pr_content(title):
                        print(f"    [过滤PR稿] {title[:40]}...")
                        continue
                    
                    summary = ""
                    if desc_elem is not None and desc_elem.text:
                        summary = clean_html(desc_elem.text)
                        if len(summary) > 400:
                            summary = summary[:397] + "..."
                    
                    if not is_ai_related(title, summary):
                        continue
                    
                    published_at = ""
                    if date_elem is not None and date_elem.text:
                        published_at = date_elem.text
                    
                    items.append({
                        'id': generate_id(title),
                        'title': title,
                        'summary': summary,
                        'source': name.replace('_', ' ').title(),
                        'heat': 'high' if any(kw in title.lower() for kw in ['openai', 'gpt', 'claude']) else 'medium',
                        'icon': config['icon'],
                        'url': link_elem.text if link_elem is not None else '',
                        'language': config['lang'],
                        'published_at': published_at,
                        'trust': config.get('trust', 3)
                    })
    except Exception as e:
        print(f"    [{name}失败] {e}")
    
    return items

# ============ 智能观点生成 ============

def generate_views(item: Dict, hn_comments: List[Dict] = None) -> Dict[str, str]:
    title = item['title'].lower()
    
    if hn_comments and len(hn_comments) > 0:
        public_view = hn_comments[0]['text'][:180] + "..." if len(hn_comments[0]['text']) > 180 else hn_comments[0]['text']
        
        critical = extract_critical_view(hn_comments)
        if critical:
            counter_view = critical
        elif len(hn_comments) > 1:
            counter_view = hn_comments[1]['text'][:180] + "..."
        else:
            counter_view = generate_counter_fallback(item)
        
        return {
            'public': f"HN讨论 ({hn_comments[0].get('points', 0)}赞): {public_view}",
            'counter': counter_view
        }
    
    return {
        'public': generate_public_fallback(item),
        'counter': generate_counter_fallback(item)
    }

def generate_public_fallback(item: Dict) -> str:
    title = item['title'].lower()
    source = item['source']
    
    if 'openai' in title:
        return "业界认为OpenAI仍是行业标杆，但技术领先优势正在缩小，竞争格局日趋激烈"
    if 'security' in title or 'vulnerability' in title:
        return "开发者社区高度关注安全风险，呼吁加强供应链审查和依赖管理"
    if 'open source' in title or '开源' in title:
        return "开源社区反响积极，认为这是推动AI民主化的重要进展"
    if 'benchmark' in title or 'sota' in title:
        return "技术圈对性能提升表示关注，但提醒实际应用效果需独立验证"
    
    return f"{source}读者关注此事，讨论集中在技术细节和商业影响层面"

def generate_counter_fallback(item: Dict) -> str:
    title = item['title'].lower()
    
    if 'openai' in title:
        return "OpenAI的护城河是用户习惯而非技术；历史证明，一旦更优替代品出现，市场地位可在数月内逆转"
    if 'funding' in title or '融资' in title or '估值' in title:
        return "大额融资往往预示泡沫顶点；收入与估值脱节的AI公司，90%将在未来24个月内倒闭或被收购"
    if 'agi' in title:
        return "AGI概念被过度炒作；当前模型本质是高级模式匹配，与真正的通用智能存在本质差距"
    if 'benchmark' in title:
        return "刷榜成绩不等于真实能力；模型往往在测试集过拟合，生产环境表现可能大打折扣"
    if 'shutdown' in title or '关闭' in title:
        return "产品关闭未必是失败；及时止损、资源重新配置，往往比硬撑更能体现战略定力"
    
    return "热点往往是噪音；真正改变行业的突破通常发生在媒体关注度低的领域，热度与价值呈负相关"

# ============ 内容过滤与排序 ============

def filter_quality_items(items: List[Dict]) -> List[Dict]:
    filtered = []
    for item in items:
        if not item.get('title'):
            continue
        
        if len(item['title']) < 10:
            continue
        
        if item['source'] not in ['Hacker News', 'GitHub Trending']:
            if not item.get('summary') or len(item['summary']) < 20:
                print(f"    [过滤无摘要] {item['title'][:40]}...")
                continue
        
        filtered.append(item)
    
    return filtered

def deduplicate_items(items: List[Dict]) -> List[Dict]:
    seen_ids = set()
    unique = []
    
    for item in items:
        item_id = item.get('id') or generate_id(item['title'])
        
        if item_id in seen_ids:
            print(f"    [去重] {item['title'][:40]}...")
            continue
        
        title_lower = item['title'].lower()
        is_dup = False
        for existing in unique:
            existing_lower = existing['title'].lower()
            if similar_titles(title_lower, existing_lower):
                print(f"    [去重-相似] {item['title'][:40]}...")
                is_dup = True
                break
        
        if not is_dup:
            seen_ids.add(item_id)
            unique.append(item)
    
    return unique

def similar_titles(t1: str, t2: str) -> bool:
    words1 = set(t1.split())
    words2 = set(t2.split())
    if not words1 or not words2:
        return False
    
    common = words1 & words2
    similarity = len(common) / max(len(words1), len(words2))
    return similarity > 0.6

def sort_by_heat_and_relevance(items: List[Dict]) -> List[Dict]:
    def score(item):
        s = 0
        if item.get('points', 0) > 100:
            s += 100
        elif item.get('points', 0) > 50:
            s += 50
        
        s += item.get('trust', 3) * 10
        
        if item.get('heat') == 'high':
            s += 30
        
        if item.get('language') == 'zh':
            s += 20
        
        return s
    
    return sorted(items, key=score, reverse=True)

# ============ 主流程 ============

def format_cards(items: List[Dict]) -> List[Dict]:
    cards = []
    
    for i, item in enumerate(items[:18]):
        print(f"  [{i+1}] {item['title'][:50]}...")
        
        hn_comments = None
        if item.get('hn_id'):
            print(f"      获取HN评论...")
            hn_comments = fetch_hn_comments(item['hn_id'])
            if hn_comments:
                print(f"      ✓ 获取 {len(hn_comments)} 条评论")
        
        views = generate_views(item, hn_comments)
        tags = extract_smart_tags(item['title'], item.get('summary', ''))
        why = generate_why(item)
        
        cards.append({
            'id': str(i + 1),
            'title': item['title'],
            'subtitle': item.get('subtitle', ''),
            'what': item.get('summary', ''),
            'why': why,
            'related': tags,
            'publicView': views['public'],
            'counterView': views['counter'],
            'heat': item.get('heat', 'medium'),
            'source': item['source'],
            'icon': item.get('icon', '🔥'),
            'url': item.get('url', ''),
            'isEnglish': item.get('language') == 'en',
            'published_at': item.get('published_at', ''),
            'trust_score': item.get('trust', 3)
        })
        
        time.sleep(0.3)
    
    return cards

def generate_why(item: Dict) -> str:
    title = item['title'].lower()
    source = item['source']
    points = item.get('points', 0)
    
    if points > 200:
        return f"HN热度极高({points}赞)，开发者社区广泛讨论，反映行业核心关切"
    if points > 100:
        return f"HN高赞({points}赞)，技术圈高度关注，具有较强的行业代表性"
    
    if 'openai' in title:
        return "OpenAI作为行业标杆，其产品/技术动态直接影响全球AI竞争格局和资本市场情绪"
    if 'security' in title or 'vulnerability' in title:
        return "AI供应链安全事件频发，直接影响开发者日常工作，企业级用户高度关注数据泄露风险"
    if 'google' in title or 'gemini' in title:
        return "Google在AI领域持续发力，Gemini系列被视为对抗OpenAI的重要力量"
    if 'meta' in title or 'llama' in title:
        return "Meta开源策略影响深远，Llama系列成为许多AI应用的底层模型"
    if 'huggingface' in source.lower():
        return "开源社区重要更新，直接影响开发者工具链和模型选择"
    if source == 'The Decoder':
        return "权威AI媒体深度报道，技术细节准确，业界高度关注"
    
    return f"{source}报道，AI行业热点话题，技术与商业结合点的讨论"

# ============ 历史存档 ============

def save_to_history(data: Dict):
    history = []
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                history = json.load(f)
        except:
            history = []
    
    history_entry = {
        'date': data['date'],
        'count': data['count'],
        'generated_at': data['generated_at']
    }
    history.insert(0, history_entry)
    history = history[:30]
    
    with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(history, f, ensure_ascii=False, indent=2)

# ============ 飞书推送 ============

def send_feishu_notification(data: Dict):
    if not FEISHU_WEBHOOK:
        print("    [飞书推送] 未配置webhook，跳过")
        return
    
    try:
        card = {
            "msg_type": "interactive",
            "card": {
                "config": {"wide_screen_mode": True},
                "header": {
                    "title": {
                        "tag": "plain_text",
                        "content": f"🤖 AI早报 {data['date']} - 共{data['count']}条"
                    },
                    "template": "blue"
                },
                "elements": [
                    {
                        "tag": "div",
                        "text": {
                            "tag": "lark_md",
                            "content": f"**生成时间**: {data['generated_at'][:16]}\n**数据来源**: Solidot, HN, The Decoder, HF, GitHub"
                        }
                    },
                    {"tag": "hr"},
                    {
                        "tag": "div",
                        "text": {
                            "tag": "lark_md",
                            "content": "**热门预览**:\n" + "\n".join([
                                f"{i+1}. {c['icon']} {c['title'][:30]}..."
                                for i, c in enumerate(data['cards'][:5])
                            ])
                        }
                    },
                    {"tag": "hr"},
                    {
                        "tag": "action",
                        "actions": [
                            {
                                "tag": "button",
                                "text": {"tag": "plain_text", "content": "查看完整数据"},
                                "url": "https://github.com/beiyuii/ai-news-swipe/blob/main/data/ai-news-daily.json",
                                "type": "primary"
                            }
                        ]
                    }
                ]
            }
        }
        
        req = urllib.request.Request(
            FEISHU_WEBHOOK,
            data=json.dumps(card).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            result = json.loads(response.read().decode())
            if result.get('code') == 0:
                print("    ✓ 飞书推送成功")
            else:
                print(f"    [飞书推送失败] {result}")
    except Exception as e:
        print(f"    [飞书推送错误] {e}")

# ============ 主函数 ============

def main():
    print(f"=== AI早报数据抓取 v8.0 {datetime.now().strftime('%Y-%m-%d %H:%M')} ===\n")
    
    all_items = []
    
    # 1. RSS源
    for name, config in RSS_SOURCES.items():
        print(f"[{len(all_items)+1}] 抓取 {name}...")
        items = fetch_rss_source(name, config)
        print(f"      ✓ 获取 {len(items)} 条")
        all_items.extend(items)
    
    # 2. Hacker News
    print(f"\n[{len(all_items)+1}] 抓取 Hacker News...")
    hn_items = fetch_hn_stories()
    print(f"      ✓ 获取 {len(hn_items)} 条")
    all_items.extend(hn_items)
    
    # 3. GitHub Trending
    print(f"[{len(all_items)+1}] 抓取 GitHub Trending...")
    gh_items = fetch_github_trending()
    print(f"      ✓ 获取 {len(gh_items)} 条")
    all_items.extend(gh_items)
    
    zh_count = len([i for i in all_items if i.get('language') == 'zh'])
    en_count = len(all_items) - zh_count
    print(f"\n📊 总计抓取: {len(all_items)} 条 (中文{zh_count} + 英文{en_count})")
    
    # 质量过滤
    print("\n🔍 质量过滤...")
    filtered_items = filter_quality_items(all_items)
    print(f"      ✓ 保留 {len(filtered_items)} 条")
    
    # 去重
    print("\n🔄 智能去重...")
    unique_items = deduplicate_items(filtered_items)
    print(f"      ✓ 剩余 {len(unique_items)} 条")
    
    # 排序
    print("\n📈 热度排序...")
    sorted_items = sort_by_heat_and_relevance(unique_items)
    
    if len(sorted_items) < 5:
        print("[!] 数据不足，请检查网络或数据源")
        return
    
    # 格式化卡片
    print(f"\n📝 格式化卡片并生成观点...")
    cards = format_cards(sorted_items)
    
    # 构建数据
    data = {
        'date': datetime.now().strftime('%Y-%m-%d'),
        'generated_at': datetime.now().isoformat(),
        'count': len(cards),
        'sources': {
            'zh': zh_count,
            'en': en_count
        },
        'cards': cards
    }
    
    # 保存
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    # 保存历史
    save_to_history(data)
    
    # 飞书推送
    print("\n📱 飞书推送...")
    send_feishu_notification(data)
    
    # 输出摘要
    print(f"\n✅ 完成！共 {len(cards)} 条卡片")
    print(f"\n预览 (前3条):")
    for card in cards[:3]:
        lang = '🌍' if card.get('isEnglish') else '🇨🇳'
        print(f"  {lang} [{card['heat']}] {card['title'][:45]}...")
        tags = ', '.join(card['related'])
        print(f"      标签: {tags}")

if __name__ == '__main__':
    main()
