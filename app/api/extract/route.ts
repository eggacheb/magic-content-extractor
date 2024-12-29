import { NextResponse } from 'next/server';
import { ExtractorFactory } from '@/app/lib/ExtractorFactory';
import { type ExtractResult } from '@/app/types/extractor';
import { load } from 'cheerio';
import TurndownService from 'turndown';

export const dynamic = 'force-dynamic';

/**
 * 从HTML中提取纯文本
 */
function extractText(html: string): string {
  const $ = load(html);
  
  // 移除脚本和样式
  $('script, style, link, meta').remove();
  
  // 处理标题
  $('h1, h2, h3, h4, h5, h6').each((_, elem) => {
    const $elem = $(elem);
    $elem.after('\n\n').before('\n\n');
  });
  
  // 处理段落和换行
  $('p, div').each((_, elem) => {
    const $elem = $(elem);
    const text = $elem.text().trim();
    if (text) {
      $elem.after('\n\n');
    }
  });
  $('br').replaceWith('\n');
  
  // 处理列表
  $('ul, ol').each((_, list) => {
    const $list = $(list);
    $list.before('\n\n');
    $list.find('li').each((_, li) => {
      const $li = $(li);
      $li.before('• ').after('\n');
    });
    $list.after('\n');
  });
  
  // 处理表格
  $('table').each((_, table) => {
    const $table = $(table);
    $table.find('tr').each((_, tr) => {
      const $tr = $(tr);
      $tr.find('td, th').each((_, cell) => {
        const $cell = $(cell);
        $cell.after('\t');
      });
      $tr.after('\n');
    });
    $table.before('\n\n').after('\n\n');
  });
  
  // 获取文本并清理
  return $('body')
    .text()
    // 清理多余空白
    .replace(/\s+/g, ' ')
    // 清理多余换行
    .replace(/\n\s*\n/g, '\n\n')
    // 清理行首尾空白
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // 清理首尾空白
    .trim();
}

/**
 * 将HTML转换为Markdown
 */
function convertToMarkdown(html: string): string {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*'
  });

  // 配置转换规则
  turndownService.addRule('strikethrough', {
    filter: (node: Node) => {
      const tagName = (node as HTMLElement).tagName?.toLowerCase();
      return ['del', 's', 'strike'].includes(tagName);
    },
    replacement: (content: string): string => `~~${content}~~`
  });

  // 保留表格
  turndownService.keep(['table', 'thead', 'tbody', 'tr', 'th', 'td']);
  
  // 保留数学公式和注释
  turndownService.addRule('math', {
    filter: (node: Node) => {
      const tagName = (node as HTMLElement).tagName?.toLowerCase();
      return ['math', 'semantics', 'annotation'].includes(tagName);
    },
    replacement: (content: string, node: Node): string => {
      const element = node as HTMLElement;
      return element.outerHTML;
    }
  });
  
  // 处理图片
  turndownService.addRule('images', {
    filter: 'img',
    replacement: (content: string, node: Node): string => {
      const img = node as HTMLElement;
      const alt = img.getAttribute('alt') || '';
      const src = img.getAttribute('src') || '';
      const title = img.getAttribute('title');
      return title
        ? `![${alt}](${src} "${title}")`
        : `![${alt}](${src})`;
    }
  });

  return turndownService.turndown(html);
}

/**
 * 判断网页类型
 */
function detectPageType(url: string, html: string): 'weixin' | 'forum' | 'article' {
  // 检查URL
  if (url.includes('mp.weixin.qq.com')) {
    return 'weixin';
  }

  const $ = load(html);
  
  // 检查论坛特征
  const forumFeatures = [
    '.post',
    '.thread',
    '.topic',
    '.forum',
    '.reply',
    '.comment-list',
    '#thread',
    '#forum'
  ];
  
  for (const selector of forumFeatures) {
    if ($(selector).length > 0) {
      return 'forum';
    }
  }
  
  // 检查URL中的论坛特征
  if (url.includes('forum') || 
      url.includes('bbs') || 
      url.includes('thread') ||
      url.includes('topic')) {
    return 'forum';
  }

  // 默认为文章
  return 'article';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');
    const outputFormat = searchParams.get('format') || 'markdown';

    if (!targetUrl) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    // 获取页面内容
    const response = await fetch(targetUrl);
    const html = await response.text();

    // 检测页面类型
    const pageType = detectPageType(targetUrl, html);
    
    // 获取对应的提取器
    const extractor = ExtractorFactory.getExtractor(pageType);

    // 提取内容
    const result = await extractor.extract(html, targetUrl);

    // 根据输出格式处理结果
    let output: Partial<ExtractResult> = {};
    
    switch (outputFormat) {
      case 'text':
        // 纯文本输出
        output = {
          title: result.title,
          content: extractText(result.content),
          textContent: result.textContent,
          metadata: result.metadata
        };
        break;
        
      case 'markdown':
        // Markdown输出
        output = {
          title: result.title,
          content: convertToMarkdown(result.content),
          textContent: result.textContent,
          metadata: result.metadata
        };
        break;
        
      default:
        // HTML输出
        output = result;
    }

    return NextResponse.json(output);
  } catch (error) {
    console.error('Error processing URL:', error);
    return NextResponse.json(
      { error: 'Failed to process URL' },
      { status: 500 }
    );
  }
} 