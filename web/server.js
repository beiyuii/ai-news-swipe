const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = 3456;
const WEBHOOK_FILE = path.join(__dirname, '..', 'data', 'saved-to-ima.json');

// IMA 配置
const IMA_CLIENT_ID = process.env.IMA_OPENAPI_CLIENTID;
const IMA_API_KEY = process.env.IMA_OPENAPI_APIKEY;
const IMA_FOLDER_ID = 'folder306d2af184844405'; // CodeX-记录

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// 存储当天已保存的卡片（内存中）
let todaySavedCards = [];
let todayDocId = null;

// 获取今天日期
function getToday() {
    return new Date().toISOString().split('T')[0];
}

// IMA API 调用封装
function imaApi(endpoint, data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        const options = {
            hostname: 'ima.qq.com',
            path: `/openapi/note/v1/${endpoint}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ima-openapi-clientid': IMA_CLIENT_ID,
                'ima-openapi-apikey': IMA_API_KEY,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => responseData += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(responseData);
                    resolve(result);
                } catch (e) {
                    reject(new Error('解析响应失败'));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// 搜索今天的笔记
async function findTodayNote() {
    try {
        const today = getToday();
        const titlePattern = `${today} AI早报`;
        
        // 搜索笔记
        const result = await imaApi('search_note_book', {
            search_type: 0,
            query_info: { title: titlePattern },
            start: 0,
            end: 10
        });
        
        if (result.retcode === 0 && result.docs && result.docs.length > 0) {
            // 找到匹配的笔记，检查是否在正确文件夹
            for (const doc of result.docs) {
                const info = doc.doc?.basic_info;
                if (info && info.title.includes(today) && info.folder_id === IMA_FOLDER_ID) {
                    return info.docid;
                }
            }
        }
        return null;
    } catch (error) {
        console.error('[IMA] 搜索笔记失败:', error.message);
        return null;
    }
}

// 创建今天的笔记
async function createTodayNote(firstCard) {
    const today = getToday();
    const title = `${today} AI早报 | 来源: ${firstCard.source}`;
    
    const content = formatCardForIMA(firstCard, 1);
    
    try {
        const result = await imaApi('import_doc', {
            content_format: 1,
            content: content,
            folder_id: IMA_FOLDER_ID
        });
        
        // API成功时直接返回 doc_id，失败时返回 retcode
        if (result.doc_id) {
            console.log(`[IMA] ✅ 创建笔记: ${title} (ID: ${result.doc_id})`);
            return result.doc_id;
        } else if (result.retcode !== 0) {
            console.error(`[IMA] 创建失败: ${result.retmsg}`);
            return null;
        }
    } catch (error) {
        console.error('[IMA] 创建笔记失败:', error.message);
        return null;
    }
}

// 追加到今天的笔记
async function appendToTodayNote(docId, card, index) {
    const content = formatCardForIMA(card, index);
    
    try {
        const result = await imaApi('append_doc', {
            doc_id: docId,
            content_format: 1,
            content: '\n\n---\n\n' + content
        });
        
        // API成功时返回空或特定字段，失败时返回 retcode
        if (result.retcode !== undefined && result.retcode !== 0) {
            console.error(`[IMA] 追加失败: ${result.retmsg}`);
            return false;
        } else {
            console.log(`[IMA] ✅ 追加第${index}条: ${card.title.substring(0, 40)}...`);
            return true;
        }
    } catch (error) {
        console.error('[IMA] 追加失败:', error.message);
        return false;
    }
}

// 格式化卡片为 IMA 格式
function formatCardForIMA(card, index) {
    const tags = card.tags?.map(t => `#${t}`).join(' ') || '#AI趋势';
    
    return `## ${index}. ${card.title}

**来源**: ${card.source} ${card.icon}  
**热度**: ${card.heat === 'high' ? '🔥 高' : '⚡ 中'}  
**标签**: ${tags}

### 📋 发生了什么
${card.what || '暂无详细内容'}

### 🔥 为什么火
${card.why}

### 💬 大众观点
${card.publicView}

### 🤔 反常识认知
${card.counterView}

🔗 [阅读原文](${card.url})
`;
}

// 保存到本地文件
async function saveToLocalFile(data) {
    try {
        const dataDir = path.dirname(WEBHOOK_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        let saved = [];
        if (fs.existsSync(WEBHOOK_FILE)) {
            const content = fs.readFileSync(WEBHOOK_FILE, 'utf-8');
            saved = JSON.parse(content);
        }

        saved.push({
            ...data,
            savedAt: new Date().toISOString(),
            id: Date.now().toString()
        });

        fs.writeFileSync(WEBHOOK_FILE, JSON.stringify(saved, null, 2));
        return true;
    } catch (error) {
        console.error('本地保存失败:', error);
        return false;
    }
}

// 主保存逻辑 - 按天合并
async function saveToIMA(data) {
    // 本地备份
    await saveToLocalFile(data);
    
    if (!IMA_CLIENT_ID || !IMA_API_KEY) {
        console.log('[IMA] 凭证未配置');
        return true;
    }

    const card = {
        title: data.title,
        source: data.source || '未知来源',
        icon: data.icon || '🔥',
        heat: data.heat || 'medium',
        tags: data.tags || [],
        what: data.what || '',
        why: data.why || '',
        publicView: data.publicView || '',
        counterView: data.counterView || '',
        url: data.url || ''
    };

    // 检查是否已有今天的笔记ID（内存缓存）
    if (!todayDocId) {
        todayDocId = await findTodayNote();
    }

    if (todayDocId) {
        // 已有笔记，追加
        todaySavedCards.push(card);
        const success = await appendToTodayNote(todayDocId, card, todaySavedCards.length);
        return success;
    } else {
        // 没有笔记，创建新的
        todaySavedCards = [card];
        todayDocId = await createTodayNote(card);
        return !!todayDocId;
    }
}

// HTTP 服务器
const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // API: 保存到 IMA
    if (pathname === '/api/save-to-ima' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const success = await saveToIMA(data);
                
                res.writeHead(success ? 200 : 500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success,
                    todayDocId,
                    savedCount: todaySavedCards.length,
                    message: success 
                        ? `已保存到 ${getToday()} AI早报 (${todaySavedCards.length}条)` 
                        : '保存失败'
                }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }

    // API: 获取已保存列表
    if (pathname === '/api/saved-items' && req.method === 'GET') {
        try {
            let saved = [];
            if (fs.existsSync(WEBHOOK_FILE)) {
                const content = fs.readFileSync(WEBHOOK_FILE, 'utf-8');
                saved = JSON.parse(content);
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                today: getToday(),
                todayDocId,
                todaySavedCount: todaySavedCards.length,
                saved
            }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // 静态文件
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, filePath);
    
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`
🚀 AI早报卡片网站 v2.0 已启动
=============================
本地访问: http://localhost:${PORT}

📁 笔记本: CodeX-记录
📝 格式: 按天合并，每天一个笔记
📌 标题: YYYY-MM-DD AI早报

等待 Cloudflare Tunnel 连接...
    `);
});
