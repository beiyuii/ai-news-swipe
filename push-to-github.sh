#!/bin/bash
# AI早报网站推送脚本

echo "=== AI早报网站 GitHub 推送 ==="
echo ""
echo "仓库地址: https://github.com/beiyuii/ai-news-swipe"
echo ""

# 进入目录
cd /root/.openclaw/workspace/ai-news-swipe

# 配置 Git 身份（可选）
git config user.name "梓庭"
git config user.email "3411708228@qq.com"

# 添加远程仓库
git remote remove origin 2>/dev/null
git remote add origin https://github.com/beiyuii/ai-news-swipe.git

# 推送到 GitHub
echo "正在推送代码到 GitHub..."
git push -u origin main

echo ""
echo "如果提示输入用户名密码:"
echo "  用户名: 你的 GitHub 用户名 (beiyuii)"
echo "  密码: 使用 GitHub Personal Access Token"
echo "  (访问 https://github.com/settings/tokens 生成)"
echo ""
echo "推送成功后，访问: https://github.com/beiyuii/ai-news-swipe"
