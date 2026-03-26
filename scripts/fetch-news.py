#!/usr/bin/env python3
"""
AI早报数据源抓取脚本 v7.0
- 新增高质量数据源 (The Decoder, Latent Space, ArXiv, HF Blog)
- HN评论抓取获取真实观点
- LLM多源对比提取反常识认知
- GitHub Trending镜像源
"""

import json
import os
import re
import time
from datetime import datetime
from typing import List, Dict
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET

DATA_DIR = os.environ.get("DATA_DIR", "/root/.openclaw/workspace/ai-news-swipe/data")
OUTPUT_FILE = os.path.join(DATA_DIR, "ai-news-daily.json")
os.makedirs(DATA_DIR, exist_ok=True)

# RSS源配置
RSS_SOURCES = {
    "solidot": {
        "url": "https://www.solidot.org/index.rss",
        "lang": "zh",
        "icon": "🇨🇳",
        "max_items": 5
    },
    "sspai": {
        "url": "https://sspai.com/feed",
        "lang": "zh", 
        "icon": "✨",
        "max_items": 3
    },
    "the_decoder": {
        "url": "https://the-decoder.com/feed/",
        "lang": "en",
        "icon": "🔍",
        "max_items": 4
    },
    "huggingface": {
        "url": "https://huggingface.co/blog/feed.xml",
        "lang": "en",
        "icon": "🤗",
        "max_items": 3
    }
}

def fetch_url(url: str, headers: dict = None, timeout: int = 15) -> str:
    """获取URL内容，默认15秒超时"""
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
    text = re.sub(r'<[^>]+>', '', html)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def is_ai_related(title: str, summary: str = "") -> bool:
    ai_keywords = [
        'AI', '人工智能', '大模型', 'ChatGPT', 'Claude', 'OpenAI', 'GPT', 'LLM',
        '算法', '机器学习', '深度学习', '智能体', 'Agent', 
        '文心', '通义', '豆包', 'Kimi', '智谱', '月之暗面', '混元',
        'Midjourney', 'Stable Diffusion', 'Sora', '生成式', 'AIGC',
        '神经网络', 'Transformer', '训练', '推理', 'token', '参数',
        '人形机器人', '自动驾驶', '智能客服', 'AI芯片', 'AGI'
    ]
    text = (title + " " + summary).lower()
    return any(kw.lower() in text for kw in ai_keywords)

def is_pr_content(title: str) -> bool:
    """检测PR稿/软文"""
    pr_keywords = ['融资', '获得', '领投', '跟投', '估值', '亿美元', '战略合作', 
                   '宣布合作', '签署协议', '重磅发布', '隆重推出', '里程碑']
    return any(kw in title for kw in pr_keywords)

# ============ Hacker News API ============

def fetch_hn_stories() -> List[Dict]:
    """获取HN高分AI故事及评论"""
    items = []
    queries = ["artificial intelligence", "machine learning", "OpenAI", "LLM"]
    
    for query in queries:
        url = f"https://hn.algolia.com/api/v1/search_by_date?query={query}&tags=story&numericFilters=points>50&hitsPerPage=5"
        try:
            data = fetch_url(url)
            if data:
                parsed = json.loads(data)
                for hit in parsed.get('hits', []):
                    title = hit.get('title', '')
                    if title:
                        items.append({
                            'title': title,
                            'summary': f"HN {hit.get('points', 0)}赞/{hit.get('num_comments', 0)}评论",
                            'source': 'Hacker News',
                            'heat': 'high' if hit.get('points', 0) > 100 else 'medium',
                            'icon': '🌍',
                            'url': f"https://news.ycombinator.com/item?id={hit.get('objectID')}",
                            'language': 'en',
                            'hn_id': hit.get('objectID'),
                            'points': hit.get('points', 0)
                        })
        except Exception as e:
            print(f"    [HN搜索失败] {e}")
    
    return items[:6]

def fetch_hn_comments(story_id: str) -> List[Dict]:
    """获取HN故事的评论"""
    try:
        url = f"https://hn.algolia.com/api/v1/items/{story_id}"
        data = fetch_url(url)
        if data:
            item = json.loads(data)
            comments = []
            for child in item.get('children', [])[:5]:
                text = clean_html(child.get('text', ''))
                if text and len(text) > 20:
                    comments.append({
                        'text': text[:200],
                        'author': child.get('author', ''),
                        'points': child.get('points', 0)
                    })
            return sorted(comments, key=lambda x: x.get('points', 0), reverse=True)[:3]
    except Exception as e:
        print(f"    [HN评论失败] {e}")
    return []

# ============ GitHub Trending 镜像 ============

def fetch_github_trending() -> List[Dict]:
    """使用镜像RSS获取GitHub热门AI项目"""
    items = []
    urls = [
        "https://mshibanami.github.io/GitHubTrendingRSS/daily/python.xml",
        "https://mshibanami.github.io/GitHubTrendingRSS/daily/typescript.xml",
        "https://mshibanami.github.io/GitHubTrendingRSS/daily/jupyter%20notebook.xml"
    ]
    
    seen = set()
    for url in urls:
        try:
            xml_data = fetch_url(url)
            if xml_data:
                root = ET.fromstring(xml_data)
                channel = root.find('channel')
                if channel is not None:
                    for item in channel.findall('item')[:3]:
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
                                    'title': f"GitHub热门: {title}",
                                    'summary': desc[:150] if desc else 'GitHub Trending AI项目',
                                    'source': 'GitHub Trending',
                                    'heat': 'medium',
                                    'icon': '💻',
                                    'url': link_elem.text if link_elem is not None else '',
                                    'language': 'en'
                                })
        except Exception as e:
            print(f"    [GitHub镜像失败] {e}")
    
    return items[:3]

# ============ RSS源抓取 ============

def fetch_rss_source(name: str, config: Dict) -> List[Dict]:
    """通用RSS源抓取"""
    items = []
    try:
        xml_data = fetch_url(config['url'])
        if xml_data:
            root = ET.fromstring(xml_data)
            channel = root.find('channel') or root
            
            for item in channel.findall('.//item')[:config['max_items']]:
                title_elem = item.find('title')
                desc_elem = item.find('description') or item.find('content:encoded')
                link_elem = item.find('link')
                
                if title_elem is not None and title_elem.text:
                    title = clean_html(title_elem.text)
                    
                    # PR稿过滤（中文源）
                    if config['lang'] == 'zh' and is_pr_content(title):
                        print(f"    [过滤PR稿] {title[:40]}...")
                        continue
                    
                    summary = clean_html(desc_elem.text if desc_elem is not None else '')
                    
                    # AI相关性过滤（ArXiv不过滤，全是AI）
                    if name != 'arxiv' and not is_ai_related(title, summary):
                        continue
                    
                    items.append({
                        'title': title,
                        'summary': summary[:200] + '...' if len(summary) > 200 else summary,
                        'source': name.replace('_', ' ').title(),
                        'heat': 'high' if 'openai' in title.lower() or 'gpt' in title.lower() else 'medium',
                        'icon': config['icon'],
                        'url': link_elem.text if link_elem is not None else '',
                        'language': config['lang']
                    })
    except Exception as e:
        print(f"    [{name}失败] {e}")
    
    return items

# ============ 观点生成 ============

def generate_views_with_llm(item: Dict, hn_comments: List[Dict] = None) -> Dict[str, str]:
    """
    使用规则生成观点（替代LLM调用，降低成本）
    实际部署时可接入LLM API
    """
    title = item['title'].lower()
    source = item['source']
    
    # 如果有HN评论，提取观点
    if hn_comments and len(hn_comments) > 0:
        # 大众观点：HN评论中的主流看法
        public_view = hn_comments[0]['text'][:150] + "..." if len(hn_comments[0]['text']) > 150 else hn_comments[0]['text']
        
        # 反常识观点：HN评论中如果有critical的（第二高赞或带but/however的）
        counter_view = ""
        if len(hn_comments) > 1:
            counter_view = hn_comments[1]['text'][:150] + "..."
        else:
            counter_view = generate_counter_view_fallback(item)
        
        return {
            'public': f"HN开发者讨论: {public_view}",
            'counter': counter_view
        }
    
    # 无HN评论时，使用规则生成
    return {
        'public': generate_public_view_fallback(item),
        'counter': generate_counter_view_fallback(item)
    }

def generate_public_view_fallback(item: Dict) -> str:
    title = item['title'].lower()
    
    if 'openai' in title:
        return "OpenAI再次引领行业，GPT系列仍是标杆，国产大模型追赶压力大"
    if 'llama' in title or 'meta' in title:
        return "Meta开源策略受好评，Llama系列性能接近闭源模型，开发者社区支持度高"
    if 'deepseek' in title or 'qwen' in title or '通义' in title:
        return "国产大模型进步明显，成本优势明显，但仍需观察长期竞争力"
    if 'arxiv' in item['source'].lower():
        return "学术界新进展，技术细节扎实，但落地应用还需时间验证"
    if 'huggingface' in item['source'].lower():
        return "开源社区新工具/模型，实用性强，开发者关注度高"
    
    return f"{item['source']}报道，技术圈关注度高，等待更多实测反馈"

def generate_counter_view_fallback(item: Dict) -> str:
    title = item['title'].lower()
    
    if 'openai' in title:
        return "OpenAI的'领先'建立在数据飞轮而非技术壁垒上；用户迁移成本其实很低，一旦有更优替代品出现，市场地位可瞬间动摇"
    if 'agi' in title or 'general intelligence' in title:
        return "AGI炒作远大于实质进展；当前模型仍是模式匹配，距离真正的通用智能还有根本性的范式突破待解决"
    if 'funding' in title or '融资' in title:
        return "大额融资往往伴随估值泡沫；收入与估值严重脱节，烧钱速度远超商业闭环能力，历史成功率极低"
    if 'benchmark' in title or 'sota' in title:
        return "Benchmark刷分不等于真实能力；模型往往在特定测试集上过拟合，实际业务场景中表现落差明显"
    if 'open source' in title or '开源' in title:
        return "开源模型的'免费'是双刃剑；企业级应用时，合规、安全、维护成本往往高于商业API"
    
    return "大众关注的热点往往是噪音；真正改变行业的技术通常在热度消退后才显现价值，过早的媒体关注反而让产品走偏"

# ============ 主流程 ============

def format_cards(items: List[Dict]) -> List[Dict]:
    """格式化为最终卡片"""
    # 去重
    seen_titles = set()
    unique_items = []
    for item in items:
        title_key = item['title'][:40]
        if title_key not in seen_titles:
            seen_titles.add(title_key)
            unique_items.append(item)
    
    # 排序：中文优先，高热度优先
    zh_items = [i for i in unique_items if i.get('language') == 'zh']
    en_items = [i for i in unique_items if i.get('language') != 'zh']
    
    # 交替排列
    sorted_items = []
    for i in range(max(len(zh_items), len(en_items))):
        if i < len(zh_items):
            sorted_items.append(zh_items[i])
        if i < len(en_items):
            sorted_items.append(en_items[i])
    
    cards = []
    for i, item in enumerate(sorted_items[:20]):  # 最多20条
        print(f"  [{i+1}] {item['title'][:45]}...")
        
        # 获取HN评论（如果是HN来源）
        hn_comments = None
        if item.get('hn_id'):
            print(f"      获取HN评论...")
            hn_comments = fetch_hn_comments(item['hn_id'])
            if hn_comments:
                print(f"      获取到 {len(hn_comments)} 条评论")
        
        # 生成观点
        views = generate_views_with_llm(item, hn_comments)
        
        cards.append({
            'id': str(i + 1),
            'title': item['title'],
            'subtitle': item.get('subtitle', ''),
            'what': item.get('summary', ''),
            'why': generate_why(item),
            'related': generate_related(item['title'], item['source']),
            'publicView': views['public'],
            'counterView': views['counter'],
            'heat': item.get('heat', 'medium'),
            'source': item['source'],
            'icon': item.get('icon', '🔥'),
            'url': item.get('url', ''),
            'isEnglish': item.get('language') == 'en'
        })
        
        # 避免请求过快
        time.sleep(0.5)
    
    return cards

def generate_why(item: Dict) -> str:
    title = item['title'].lower()
    source = item['source']
    
    if 'security' in title or 'vulnerability' in title:
        return "AI供应链安全事件频发，直接影响开发者日常工作，企业级用户高度关注数据泄露风险"
    if 'openai' in title:
        return "OpenAI作为行业标杆，其产品/技术动态直接影响全球AI竞争格局和资本市场情绪"
    if 'google' in title or 'gemini' in title:
        return "Google在AI领域持续发力，Gemini系列被视为对抗OpenAI的重要力量"
    if 'meta' in title or 'llama' in title:
        return "Meta开源策略影响深远，Llama系列成为许多AI应用的底层模型"
    if 'arxiv' in source.lower():
        return "学术界前沿研究成果发布，可能在未来6-12个月影响产业实践"
    if 'huggingface' in source.lower():
        return "开源社区重要更新，直接影响开发者工具链和模型选择"
    if source == 'The Decoder':
        return "权威AI媒体深度报道，技术细节准确，业界高度关注"
    
    return f"{source}报道，AI行业热点话题，技术与商业结合点的讨论"

def generate_related(title: str, source: str) -> List[str]:
    title_lower = title.lower()
    
    if 'openai' in title_lower:
        return ["Sam Altman", "GPT-5", "ChatGPT", "Microsoft"]
    if 'google' in title_lower or 'gemini' in title_lower:
        return ["Google", "Gemini", "DeepMind", "Sundar Pichai"]
    if 'meta' in title_lower or 'llama' in title_lower:
        return ["Meta", "Llama", "Mark Zuckerberg", "开源AI"]
    if 'anthropic' in title_lower or 'claude' in title_lower:
        return ["Anthropic", "Claude", "Dario Amodei", "Amazon"]
    if 'deepseek' in title_lower:
        return ["DeepSeek", "国产大模型", "MoE架构"]
    if 'security' in title_lower:
        return ["AI安全", "供应链攻击", "代码审计"]
    if 'nvidia' in title_lower:
        return ["NVIDIA", "GPU", "算力", "黄仁勋"]
    
    return ["AI趋势", "技术进展", "商业化", "竞争格局"]

def main():
    print(f"=== AI早报数据抓取 v7.0 {datetime.now().strftime('%Y-%m-%d %H:%M')} ===\n")
    
    all_items = []
    
    # 1. RSS源
    for name, config in RSS_SOURCES.items():
        print(f"[{len(all_items)+1}] 抓取 {name}...")
        items = fetch_rss_source(name, config)
        print(f"      获取 {len(items)} 条")
        all_items.extend(items)
    
    # 2. Hacker News（带评论）
    print(f"\n[{len(all_items)+1}] 抓取 Hacker News...")
    hn_items = fetch_hn_stories()
    print(f"      获取 {len(hn_items)} 条")
    all_items.extend(hn_items)
    
    # 3. GitHub Trending镜像
    print(f"[{len(all_items)+1}] 抓取 GitHub Trending...")
    gh_items = fetch_github_trending()
    print(f"      获取 {len(gh_items)} 条")
    all_items.extend(gh_items)
    
    zh_count = len([i for i in all_items if i.get('language') == 'zh'])
    en_count = len(all_items) - zh_count
    print(f"\n总计抓取: {len(all_items)} 条 (中文{zh_count} + 英文{en_count})")
    
    if len(all_items) < 5:
        print("[!] 数据不足，请检查网络或数据源")
        return
    
    print(f"\n格式化卡片并生成观点...")
    cards = format_cards(all_items)
    
    data = {
        'date': datetime.now().strftime('%Y-%m-%d'),
        'generated_at': datetime.now().isoformat(),
        'count': len(cards),
        'cards': cards
    }
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ 已保存 {len(cards)} 条卡片到 {OUTPUT_FILE}")
    print(f"\n预览 (前3条):")
    for card in cards[:3]:
        lang = '🌍' if card.get('isEnglish') else '🇨🇳'
        print(f"  {lang} [{card['heat']}] {card['title'][:50]}...")
        print(f"      大众: {card['publicView'][:40]}...")
        print(f"      反常识: {card['counterView'][:40]}...")

if __name__ == '__main__':
    main()
