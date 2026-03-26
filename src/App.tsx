import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import { Settings, ArrowLeft, Copy, Send, Flame, Zap, X, Check } from 'lucide-react'
import './index.css'

// Types
interface NewsCard {
  id: string
  title: string
  subtitle?: string  // 中文副标题（英文内容）
  what: string
  why: string
  related?: string[]  // 相关热点
  publicView: string   // 大众观点（主流认知）
  counterView: string  // 反常识认知
  heat: 'high' | 'medium' | 'low'
  source: string
  icon: string
  url?: string
  isEnglish?: boolean
}

// Mock Data - 2026-03-25 AI早报
const mockNews: NewsCard[] = [
  {
    id: '1',
    title: 'Anthropic 为 Claude Code 引入自动模式',
    what: 'Claude Code 现在可以自动操控用户电脑完成任务，全力推进 AI 智能体研发',
    why: '这是「AI Agent 自主执行」的里程碑突破，程序员群体热议「AI 抢饭碗」焦虑',
    publicView: 'AI终于要来抢程序员工作了，写代码的都要失业了',
    counterView: '自动执行≠自动理解需求：AI能执行但难以对齐复杂业务目标，程序员的价值从写代码转向定义问题和验收标准',
    heat: 'high',
    source: 'Anthropic 官方 / 网易科技',
    icon: '🤖'
  },
  {
    id: '2',
    title: 'OpenAI 停止 Sora 视频生成服务',
    what: '推出仅 6 个月的 Sora 独立应用即将关停，OpenAI 要简化产品线',
    why: '用户刚充的钱可能打水漂，「被抛弃」情绪在社群蔓延',
    publicView: 'OpenAI又在割韭菜，用户充的钱打水漂，这种公司不靠谱',
    counterView: '战略聚焦是成熟公司的标志：放弃边缘业务集中资源于核心模型，这正是Sam Altman管理能力的体现',
    heat: 'high',
    source: 'OpenAI / 华尔街见闻',
    icon: '🎬'
  },
  {
    id: '3',
    title: '挪威主权财富基金将让 AI 参与投资决策',
    what: '全球最大主权基金（2.1万亿美元）计划让 AI 在人类监督下做投资',
    why: '「AI 管钱」引发散户 vs 机构博弈讨论，700 名员工一半在用 Claude',
    publicView: '连世界上最大的基金都用AI炒股了，散户彻底没活路了',
    counterView: 'AI投资的核心优势是处理信息广度而非深度：在另类数据挖掘上有优势，但在市场极端情绪和黑天鹅事件上仍依赖人类判断',
    heat: 'high',
    source: 'IT之家 / 新浪财经',
    icon: '💰'
  },
  {
    id: '4',
    title: 'OpenAI 获 100 亿美元新融资',
    what: 'OpenAI 从 MGX、Coatue、Thrive 再募 100 亿美元，Altman 不再直接监督新模型开发',
    why: '估值逼近 8500 亿美元，「Agent 原生」时代加速到来',
    publicView: 'OpenAI估值越来越离谱，这明显是泡沫，投资人迟早被套',
    counterView: 'Altman放权是组织架构进化的信号：从创始人驱动转向制度驱动，这是公司从startup到enterprise转型的必经之路',
    heat: 'medium',
    source: '网易科技 / 腾讯新闻',
    icon: '🚀'
  },
  {
    id: '5',
    title: '腾讯混元 T1 正式上线',
    what: '业界首个 Transformer-Mamba 混合架构推理模型，解码速度提升 2 倍',
    why: '国产大模型在长文本处理上扳回一城，即将在元宝灰度上线',
    publicView: '国产大模型又来蹭热度，跟GPT比还是差远了',
    counterView: 'Mamba架构在长序列上的O(n)复杂度是质变：虽然通用能力仍有差距，但在特定场景（如代码补全、长文档处理）已具备替代GPT的性价比',
    heat: 'medium',
    source: '腾讯研究院',
    icon: '🇨🇳'
  }
]

// Components
const HeatTag = ({ heat }: { heat: 'high' | 'medium' | 'low' }) => {
  const config = {
    high: { icon: '🔥🔥🔥', text: '高热度', color: 'text-red-400', border: 'border-red-500/30', bg: 'from-red-500/10 to-red-500/5' },
    medium: { icon: '🔥🔥', text: '中热度', color: 'text-orange-400', border: 'border-orange-500/30', bg: 'from-orange-500/10 to-orange-500/5' },
    low: { icon: '🔥', text: '低热度', color: 'text-green-400', border: 'border-green-500/30', bg: 'from-green-500/10 to-green-500/5' }
  }
  const c = config[heat]
  
  return (
    <span className={`absolute top-4 left-4 px-3 py-1.5 rounded-full text-xs font-bold border ${c.border} bg-gradient-to-r ${c.bg} ${c.color} flex items-center gap-1`}>
      <Flame size={12} />
      {c.icon} {c.text}
    </span>
  )
}

// Settings Modal
const SettingsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full bg-gradient-to-br from-[#14141e] to-[#0a0a0f] rounded-t-3xl p-6 border-t border-white/10"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">设置</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
            <X size={18} className="text-white/60" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-white/5">
            <span className="text-white/80">推送时间</span>
            <span className="text-white/50 text-sm">每天 09:07</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-white/5">
            <span className="text-white/80">热点来源</span>
            <span className="text-white/50 text-sm text-right">国内:微博/知乎/即刻/36氪<br/>海外:Twitter/Reddit/HN/TC</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-white/80">关于</span>
            <span className="text-white/50 text-sm">AI早报 v1.0</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Detail Modal
const DetailModal = ({ card, isOpen, onClose, onKeep, onReject }: { 
  card: NewsCard | null
  isOpen: boolean
  onClose: () => void
  onKeep: () => void
  onReject: () => void
}) => {
  if (!isOpen || !card) return null
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-sm bg-gradient-to-br from-[#14141e] to-[#0a0a0f] rounded-3xl overflow-hidden border border-white/10 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative h-36 bg-gradient-to-br from-[#1a0a2e] to-[#0f0518] flex items-center justify-center">
          <HeatTag heat={card.heat} />
          <div className="text-5xl">{card.icon}</div>
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center"
          >
            <X size={18} className="text-white" />
          </button>
          {/* 语言标签 */}
          {card.isEnglish && (
            <span className="absolute top-4 right-14 px-2 py-1 rounded-full text-xs bg-blue-500/30 text-blue-300 border border-blue-500/30">
              EN
            </span>
          )}
        </div>
        
        <div className="p-5">
          {/* 标题 */}
          <h2 className="text-lg font-bold text-white leading-tight">{card.title}</h2>
          {/* 中文副标题（仅英文内容） */}
          {card.isEnglish && card.subtitle && (
            <p className="text-white/50 text-sm mt-1.5 flex items-center gap-1.5">
              <span className="text-blue-400/60 text-xs">译</span>
              {card.subtitle}
            </p>
          )}
          
          {/* 发生了什么 */}
          <div className="mt-4">
            <div className="flex items-center gap-2 text-white/80 text-sm font-semibold mb-2">
              <span className="w-5 h-5 rounded bg-gradient-to-br from-blue-500/30 to-blue-500/10 flex items-center justify-center text-xs">发</span>
              发生了什么
            </div>
            <p className="text-white/60 text-sm leading-relaxed pl-7">{card.what || '暂无详细描述'}</p>
          </div>
          
          {/* 为什么火 */}
          <div className="mt-4">
            <div className="flex items-center gap-2 text-white/80 text-sm font-semibold mb-2">
              <span className="w-5 h-5 rounded bg-gradient-to-br from-orange-500/30 to-orange-500/10 flex items-center justify-center text-xs">火</span>
              为什么火
            </div>
            <p className="text-white/60 text-sm leading-relaxed pl-7">{card.why}</p>
          </div>

          {/* 大众观点 */}
          <div className="mt-4 bg-gradient-to-r from-[rgba(99,102,241,0.15)] to-[rgba(99,102,241,0.05)] border border-[rgba(99,102,241,0.2)] rounded-xl p-3.5 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-500" />
            <div className="flex items-center gap-1.5 text-indigo-400 text-sm font-semibold mb-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              大众观点
            </div>
            <p className="text-white/60 text-xs leading-relaxed">{card.publicView}</p>
          </div>

          {/* 反常识认知 */}
          <div className="mt-3 bg-gradient-to-r from-[rgba(16,185,129,0.15)] to-[rgba(16,185,129,0.05)] border border-[rgba(16,185,129,0.2)] rounded-xl p-3.5 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-green-500" />
            <div className="flex items-center gap-1.5 text-emerald-400 text-sm font-semibold mb-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
              反常识认知
            </div>
            <p className="text-white/60 text-xs leading-relaxed">{card.counterView}</p>
          </div>

          {/* 相关热点 */}
          {card.related && card.related.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 text-white/80 text-sm font-semibold mb-2">
                <span className="w-5 h-5 rounded bg-gradient-to-br from-purple-500/30 to-purple-500/10 flex items-center justify-center text-xs">关</span>
                相关热点
              </div>
              <div className="pl-7 flex flex-wrap gap-2">
                {card.related.slice(0, 5).map((tag, i) => (
                  <span key={i} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* 来源 */}
          <div className="mt-4 pt-3 border-t border-white/10">
            <span className="text-white/40 text-xs">来源：{card.source}</span>
            {card.url && (
              <a href={card.url} target="_blank" rel="noopener noreferrer" className="text-blue-400/60 text-xs ml-3 hover:text-blue-400">
                查看原文 →
              </a>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onReject}
              className="flex-1 h-12 rounded-xl bg-gradient-to-br from-[rgba(239,68,68,0.2)] to-[rgba(239,68,68,0.1)] border border-red-500/50 text-red-400 font-semibold flex items-center justify-center gap-2"
            >
              <X size={18} />
              舍弃
            </button>
            <button
              onClick={onKeep}
              className="flex-1 h-12 rounded-xl bg-gradient-to-br from-[rgba(16,185,129,0.2)] to-[rgba(16,185,129,0.1)] border border-green-500/50 text-green-400 font-semibold flex items-center justify-center gap-2"
            >
              <Check size={18} />
              保留
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Swipe Card
const SwipeCard = ({
  card,
  onSwipe,
  isTop,
  onClick
}: {
  card: NewsCard
  onSwipe: (direction: 'left' | 'right') => void
  isTop: boolean
  onClick: () => void
}) => {
  const [exitX, setExitX] = useState(0)

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 100
    if (info.offset.x > threshold) {
      setExitX(500)
      onSwipe('right')
    } else if (info.offset.x < -threshold) {
      setExitX(-500)
      onSwipe('left')
    }
  }

  return (
    <motion.div
      className={`absolute inset-0 ${isTop ? 'z-10' : 'z-0 scale-95 opacity-50'}`}
      style={{ x: isTop ? 0 : 0 }}
      animate={{
        x: exitX,
        opacity: exitX !== 0 ? 0 : 1,
        scale: isTop ? 1 : 0.95
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      onClick={onClick}
    >
      <div className="h-full bg-gradient-to-br from-[#14141e] to-[#0a0a0f] rounded-3xl border border-white/[0.08] shadow-[0_0_0_1px_rgba(131,56,236,0.1),0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden relative cursor-pointer active:scale-[0.98] transition-transform">
        {/* Glow effect */}
        <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-[rgba(131,56,236,0.15)] to-transparent pointer-events-none" />
        
        {/* Image area */}
        <div className="relative h-44 bg-gradient-to-br from-[#1a0a2e] to-[#0f0518] flex items-center justify-center">
          <HeatTag heat={card.heat} />
          {/* 语言标签 */}
          {card.isEnglish && (
            <span className="absolute top-4 right-4 px-2 py-1 rounded-full text-xs bg-blue-500/30 text-blue-300 border border-blue-500/30">
              EN
            </span>
          )}
          <div className="text-6xl">{card.icon}</div>
        </div>
        
        {/* Content */}
        <div className="p-5 flex flex-col h-[calc(100%-11rem)]">
          {/* 标题 */}
          <h2 className="text-xl font-bold text-white leading-tight">{card.title}</h2>
          {/* 中文副标题（仅英文内容） */}
          {card.isEnglish && card.subtitle && (
            <p className="text-white/40 text-sm mt-1.5 flex items-center gap-1">
              <span className="text-blue-400/50 text-xs">译</span>
              <span className="truncate">{card.subtitle}</span>
            </p>
          )}
          
          {/* 发生了什么 - 摘要 */}
          <p className="text-white/50 text-sm mt-3 leading-relaxed line-clamp-2">{card.what || '点击展开详情...'}</p>
          
          {/* 大众观点预览 */}
          <div className="mt-4 bg-gradient-to-r from-[rgba(99,102,241,0.1)] to-[rgba(99,102,241,0.05)] border border-[rgba(99,102,241,0.15)] rounded-xl p-3 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-purple-500" />
            <div className="flex items-center gap-1.5 text-indigo-400/80 text-sm font-semibold">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              大众观点
            </div>
            <p className="text-white/40 text-xs mt-1.5 line-clamp-1">{card.publicView}</p>
          </div>
          
          {/* Footer */}
          <div className="mt-auto pt-4 flex justify-between items-center border-t border-white/[0.06]">
            <span className="text-white/40 text-xs">来源：{card.source}</span>
            <span className="text-white/30 text-xs">点击展开详情 →</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

const MainScreen = ({
  cards,
  onSwipe,
  selectedCount,
  onViewSelected
}: {
  cards: NewsCard[]
  onSwipe: (id: string, direction: 'left' | 'right') => void
  selectedCount: number
  onViewSelected: () => void
}) => {
  const [showSettings, setShowSettings] = useState(false)
  const [selectedCard, setSelectedCard] = useState<NewsCard | null>(null)

  const handleCardClick = (card: NewsCard) => {
    setSelectedCard(card)
  }

  const handleKeepFromModal = () => {
    if (selectedCard) {
      onSwipe(selectedCard.id, 'right')
      setSelectedCard(null)
    }
  }

  const handleRejectFromModal = () => {
    if (selectedCard) {
      onSwipe(selectedCard.id, 'left')
      setSelectedCard(null)
    }
  }

  return (
    <div className="h-screen bg-[#0a0a0f] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-5 bg-gradient-to-b from-[rgba(20,20,30,0.9)] to-transparent border-b border-white/[0.05]">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="bg-gradient-to-r from-[#ff006e] to-[#8338ec] bg-clip-text text-transparent">AI</span>
          早报
        </h1>
        <button 
          onClick={() => setShowSettings(true)}
          className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition active:scale-95"
        >
          <Settings size={18} />
        </button>
      </header>
      
      {/* Card Area */}
      <div className="flex-1 px-5 py-4 relative">
        <div className="h-full relative">
          <AnimatePresence>
            {cards.map((card, index) => (
              <SwipeCard
                key={card.id}
                card={card}
                onSwipe={(dir) => onSwipe(card.id, dir)}
                isTop={index === cards.length - 1}
                onClick={() => handleCardClick(card)}
              />
            ))}
          </AnimatePresence>
          
          {cards.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-white/40">
              <Zap size={48} className="mb-4 opacity-50" />
              <p className="text-lg font-medium">今日早报已刷完</p>
              <p className="text-sm mt-2">去查看已选列表导出吧</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Action Bar */}
      <div className="px-10 py-6 flex justify-center items-center gap-8">
        <button
          onClick={() => cards.length > 0 && onSwipe(cards[cards.length - 1].id, 'left')}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-[rgba(239,68,68,0.2)] to-[rgba(239,68,68,0.1)] border-2 border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.3)] flex items-center justify-center active:scale-95 transition hover:shadow-[0_0_40px_rgba(239,68,68,0.5)]"
        >
          <div className="w-6 h-1 bg-red-500 rounded-full" />
        </button>
        
        <button 
          onClick={() => cards.length > 0 && handleCardClick(cards[cards.length - 1])}
          className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-1 active:scale-95 transition"
        >
          <div className="w-4 h-0.5 bg-white/40 rounded-full" />
          <div className="w-2.5 h-0.5 bg-white/40 rounded-full" />
        </button>
        
        <button
          onClick={() => cards.length > 0 && onSwipe(cards[cards.length - 1].id, 'right')}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-[rgba(16,185,129,0.2)] to-[rgba(16,185,129,0.1)] border-2 border-green-500/50 shadow-[0_0_30px_rgba(16,185,129,0.3)] flex items-center justify-center active:scale-95 transition hover:shadow-[0_0_40px_rgba(16,185,129,0.5)]"
        >
          <svg width="24" height="20" viewBox="0 0 24 20" fill="none" className="text-green-500">
            <path d="M2 10L8 16L22 2" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      
      {/* Bottom Bar */}
      <div className="h-20 bg-gradient-to-t from-[#0a0a0f] to-transparent border-t border-white/[0.05] flex items-center justify-between px-6">
        <span className="text-white/60 text-sm">
          已选: <span className="text-[#ff006e] font-bold">{selectedCount}</span>个
        </span>
        <button
          onClick={onViewSelected}
          className="bg-gradient-to-r from-[#8338ec] to-[#ff006e] text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-[0_4px_20px_rgba(131,56,236,0.4)] active:scale-95 transition"
        >
          查看已选 →
        </button>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showSettings && <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />}
      </AnimatePresence>
      
      <AnimatePresence>
        <DetailModal 
          card={selectedCard} 
          isOpen={!!selectedCard} 
          onClose={() => setSelectedCard(null)}
          onKeep={handleKeepFromModal}
          onReject={handleRejectFromModal}
        />
      </AnimatePresence>
    </div>
  )
}

const SelectedScreen = ({
  selectedCards,
  onBack,
  onCopy,
  onSendToFeishu,
  onCreateIMANote
}: {
  selectedCards: NewsCard[]
  onBack: () => void
  onCopy: () => void
  onSendToFeishu: () => void
  onCreateIMANote: () => void
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false)
  
  const getHeatIcon = (heat: string) => {
    if (heat === 'high') return '🔥🔥🔥'
    if (heat === 'medium') return '🔥🔥'
    return '🔥'
  }
  
  return (
    <div className="h-screen bg-[#0a0a0f] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 flex items-center px-5 border-b border-white/[0.05]">
        <button onClick={onBack} className="flex items-center gap-2 text-white font-bold">
          <ArrowLeft size={20} />
          <span>已选列表</span>
        </button>
      </header>
      
      {/* List */}
      <div className="flex-1 overflow-y-auto p-5">
        {selectedCards.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/40">
            <p className="text-lg">还没有选择任何内容</p>
            <p className="text-sm mt-2">右滑卡片来保留感兴趣的新闻</p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedCards.map((card) => (
              <div
                key={card.id}
                className="bg-gradient-to-br from-[rgba(20,20,30,0.8)] to-[rgba(10,10,15,0.9)] rounded-2xl p-4 flex gap-3.5 border border-white/[0.06] shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
              >
                <div className={`w-[60px] h-[60px] rounded-xl flex items-center justify-center text-2xl flex-shrink-0 border ${
                  card.heat === 'high' ? 'border-[rgba(239,68,68,0.3)] bg-gradient-to-br from-red-500/10 to-red-500/5' :
                  card.heat === 'medium' ? 'border-[rgba(245,158,11,0.3)] bg-gradient-to-br from-orange-500/10 to-orange-500/5' :
                  'border-[rgba(16,185,129,0.3)] bg-gradient-to-br from-green-500/10 to-green-500/5'
                }`}>
                  {card.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold text-sm leading-snug truncate">{card.title}</h3>
                  <p className="text-white/40 text-[11px] mt-1">
                    {getHeatIcon(card.heat)} {card.heat === 'high' ? '高热度' : card.heat === 'medium' ? '中热度' : '低热度'}
                  </p>
                  <p className="text-white/30 text-[10px] mt-1 truncate">{card.source}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Export Bar */}
      <div className="h-[90px] bg-gradient-to-t from-[#0a0a0f] to-transparent border-t border-white/[0.05] flex items-center justify-center px-5 gap-3">
        <button
          onClick={() => setShowExportMenu(true)}
          className="flex-1 h-12 rounded-full bg-gradient-to-r from-[#8338ec] to-[#ff006e] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(131,56,236,0.4)] active:scale-95 transition"
        >
          <Send size={16} />
          导出选项
        </button>
      </div>

      {/* Export Menu Modal */}
      <AnimatePresence>
        {showExportMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end"
            onClick={() => setShowExportMenu(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full bg-gradient-to-br from-[#14141e] to-[#0a0a0f] rounded-t-3xl p-6 border-t border-white/10"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">导出到</h3>
                <button onClick={() => setShowExportMenu(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                  <X size={18} className="text-white/60" />
                </button>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={() => { onCopy(); setShowExportMenu(false) }}
                  className="w-full h-14 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3 px-4 active:scale-[0.98] transition"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Copy size={18} className="text-blue-400" />
                  </div>
                  <span className="text-white font-medium">复制文案</span>
                </button>
                
                <button
                  onClick={() => { onCreateIMANote(); setShowExportMenu(false) }}
                  className="w-full h-14 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3 px-4 active:scale-[0.98] transition"
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <span className="text-purple-400 font-bold text-sm">IMA</span>
                  </div>
                  <span className="text-white font-medium">保存到 IMA 笔记</span>
                </button>
                
                <button
                  onClick={() => { onSendToFeishu(); setShowExportMenu(false) }}
                  className="w-full h-14 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3 px-4 active:scale-[0.98] transition"
                >
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <Send size={18} className="text-green-400" />
                  </div>
                  <span className="text-white font-medium">发送到飞书</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Main App
function App() {
  const [cards, setCards] = useState<NewsCard[]>(mockNews)
  const [selected, setSelected] = useState<NewsCard[]>([])
  const [currentScreen, setCurrentScreen] = useState<'main' | 'selected'>('main')
  const [loading, setLoading] = useState(true)

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/data/ai-news-daily.json')
        if (response.ok) {
          const data = await response.json()
          if (data.cards && data.cards.length > 0) {
            setCards(data.cards)
          }
        }
      } catch (error) {
        console.error('加载数据失败:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [])

  const handleSwipe = useCallback((id: string, direction: 'left' | 'right') => {
    const card = cards.find(c => c.id === id)
    if (!card) return
    
    setCards(prev => prev.filter(c => c.id !== id))
    
    if (direction === 'right') {
      setSelected(prev => [...prev, card])
    }
  }, [cards])

  const handleCopy = () => {
    const heatIcon = (heat: string) => heat === 'high' ? '🔥🔥🔥' : heat === 'medium' ? '🔥🔥' : '🔥'
    const text = selected.map((card, index) => {
      const title = card.isEnglish && card.subtitle 
        ? `${card.title}\n【译】${card.subtitle}` 
        : card.title
      const relatedTags = card.related ? `\n【相关】${card.related.slice(0, 4).join(' / ')}` : ''
      
      return `${index + 1}️⃣ ${title} ${heatIcon(card.heat)}
【发生了什么】${card.what || '暂无详细描述'}
【为什么火】${card.why}
【大众观点】${card.publicView}
【反常识认知】${card.counterView}${relatedTags}
【来源】${card.source}
`
    }).join('\n---\n')
    
    navigator.clipboard.writeText(`# 🔥 AI早报 | ${new Date().toLocaleDateString('zh-CN')}\n\n${text}\n\n📊 共 ${selected.length} 条精选`)
    alert('文案已复制到剪贴板！')
  }

  const handleSendToFeishu = () => {
    alert('发送到飞书功能开发中...')
  }

  const handleCreateIMANote = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/save-to-ima', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cards: selected,
          date: new Date().toLocaleDateString('zh-CN')
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        alert(`✅ 已保存到 IMA 笔记！\n笔记ID: ${result.docId}`)
      } else {
        alert(`保存失败: ${result.error}`)
      }
    } catch (error) {
      alert(`请求失败: ${error instanceof Error ? error.message : '请检查网络连接'}`)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      {loading ? (
        <div className="h-screen bg-[#0a0a0f] flex items-center justify-center">
          <div className="text-white/60">加载中...</div>
        </div>
      ) : currentScreen === 'main' ? (
        <MainScreen
          cards={cards}
          onSwipe={handleSwipe}
          selectedCount={selected.length}
          onViewSelected={() => setCurrentScreen('selected')}
        />
      ) : (
        <SelectedScreen
          selectedCards={selected}
          onBack={() => setCurrentScreen('main')}
          onCopy={handleCopy}
          onSendToFeishu={handleSendToFeishu}
          onCreateIMANote={handleCreateIMANote}
        />
      )}
    </div>
  )
}

export default App
