const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

// IMA API 配置
const IMA_CLIENT_ID = process.env.IMA_OPENAPI_CLIENTID || '';
const IMA_API_KEY = process.env.IMA_OPENAPI_APIKEY || '';

// 保存到 IMA
app.post('/api/save-to-ima', async (req, res) => {
  try {
    const { cards, date } = req.body;
    
    if (!cards || cards.length === 0) {
      return res.json({ success: false, error: '没有选中内容' });
    }

    // 构建 Markdown 内容
    const heatIcon = (heat) => heat === 'high' ? '🔥🔥🔥' : heat === 'medium' ? '🔥🔥' : '🔥';
    
    const content = `# 🔥 AI早报精选 - ${date}

${cards.map((card, index) => `
## ${index + 1}. ${card.title} ${heatIcon(card.heat)}

**发生了什么：**
${card.what}

**为什么火：**
${card.why}

**抖音角度：**
${card.douyinAngle}

**来源：** ${card.source}
`).join('---\n')}

📊 共 ${cards.length} 条精选内容`;

    // 调用 IMA API
    const response = await fetch('https://ima.qq.com/openapi/note/v1/import_doc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ima-openapi-clientid': IMA_CLIENT_ID,
        'ima-openapi-apikey': IMA_API_KEY
      },
      body: JSON.stringify({
        content_format: 1,
        content: content
      })
    });

    const result = await response.json();
    
    if (result.doc_id) {
      res.json({ success: true, docId: result.doc_id });
    } else {
      res.json({ success: false, error: result.msg || '保存失败' });
    }
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', imaConfigured: !!(IMA_CLIENT_ID && IMA_API_KEY) });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
