# Web Content Extractor

一个简单高效的网页内容提取工具，专门设计用于AI分析场景。本工具可以清理网页中的广告、导航栏等无关内容，只保留主要文章内容，使AI能够更好地理解和分析文本。

## 🌟 特点

- 🚀 基于Next.js构建的现代Web应用
- 📝 使用Mozilla的Readability算法提取主要内容
- 🧹 自动清理多余的HTML标签和格式
- 🎯 专注于提取对AI分析有价值的内容
- 💨 快速且轻量级的API

## 🔗 在线演示

访问 [https://web-content-extractor.vercel.app](https://web-content-extractor.vercel.app) 体验在线版本。

一键部署：[![Vercel Deployment](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/eggacheb/web-content-extractor)


![image](https://github.com/user-attachments/assets/a9f717bb-bef6-4b15-b4cd-7d8099b5520c)

![image](https://github.com/user-attachments/assets/ef8f97fc-4a12-4c8d-bc51-85fb5874912b)


## 🛠️ 技术栈

- **Frontend**:
  - Next.js 14
  - React
  - Tailwind CSS
  - TypeScript
  - Lucide Icons

- **Backend**:
  - Next.js API Routes
  - Readability.js
  - Puppeteer

## 🚀 快速开始

1. 克隆项目
```bash
git clone https://github.com/eggacheb/web-content-extractor.git
cd web-content-extractor
```

2. 安装依赖
```bash
npm install
```

3. 启动开发服务器
```bash
npm run dev
```

4. 打开浏览器访问 [http://localhost:3000](http://localhost:3000)

## 📚 API 使用

### 提取网页内容

```http
GET /api/extract?url=https://example.com
```

#### 响应字段说明

- `title`: 文章标题
- `content`: 清理后的文章完整内容
- `excerpt`: 文章的自动生成摘要（通常是文章的开头部分）
- `byline`: 作者信息（如果有）
- `length`: 文章内容的字符长度

#### 响应示例

```json
{
  "title": "文章标题",
  "content": "文章正文内容...",
  "excerpt": "文章摘要",
  "byline": "作者信息（如果有）",
  "length": 1234
}
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License - 查看 [LICENSE](LICENSE) 文件了解更多信息。
