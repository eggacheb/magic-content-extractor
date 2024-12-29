import * as cheerio from 'cheerio';
import type { CheerioAPI, AnyNode } from 'cheerio';
import type { Element, Node } from 'domhandler';
import { CleanOptions } from '../types/extractor';

/**
 * 计算文本长度
 * 支持中文、英文、日文、阿拉伯文
 */
export function calculateTextLength(text: string): number {
  if (!text) return 0;
  
  // 规范化空白字符
  text = text.replace(/\s+/g, ' ').replace(/[\n\t\r]+/g, '\n');
  
  // 计算英文单词数
  const englishWords = text.split(/\s+/).length;
  
  // 计算中文字符数
  const chineseChars = text.match(/[\u4e00-\u9fff]/g)?.length || 0;
  
  // 计算日文字符数
  const japaneseChars = text.match(/[\u3040-\u309F\u30A0-\u30FF]/g)?.length || 0;
  
  // 计算阿拉伯文字符数
  const arabicChars = text.match(/[\u0600-\u06FF]/g)?.length || 0;
  
  return englishWords + chineseChars + japaneseChars + arabicChars;
}

/**
 * 清理HTML
 */
export function cleanHtml($: CheerioAPI, options: CleanOptions = {}): void {
  const {
    removeScripts = true,
    removeStyles = true,
    removeComments = true
  } = options;
  
  // 移除注释
  if (removeComments) {
    $('*').contents().each((index: number, node: Node) => {
      if (node.type === 'comment') {
        $(node).remove();
      }
    });
  }
  
  // 移除脚本
  if (removeScripts) {
    $('script').remove();
  }
  
  // 移除样式
  if (removeStyles) {
    $('style').remove();
    $('link[rel="stylesheet"]').remove();
  }
  
  // 清理空白节点
  $('*').each((index: number, elem: Node) => {
    const $elem = $(elem);
    if (!$elem.contents().length && !isPreservableNode(elem)) {
      $elem.remove();
    }
  });
}

/**
 * 检查节点是否应该保留
 */
export function isPreservableNode(node: Node): boolean {
  return ['img', 'video', 'iframe', 'embed'].includes(node.tagName?.toLowerCase() || '');
}

/**
 * 检查节点是否是空的
 */
export function isEmptyNode(node: Node, $: CheerioAPI): boolean {
  const $node = $(node);
  return !$node.children().length && !$node.text().trim();
}

/**
 * 检查节点是否包含有效内容
 */
export function hasValidContent(node: Node, $: CheerioAPI, minTextLength: number = 25): boolean {
  const $node = $(node);
  
  // 检查是否包含多媒体内容
  if ($node.find('img, video, iframe').length > 0) {
    return true;
  }
  
  // 检查文本内容
  const text = $node.text().trim();
  if (text.length >= minTextLength) {
    const linkText = $node.find('a').text().trim();
    const linkDensity = linkText.length / text.length;
    return linkDensity < 0.5;
  }
  
  return false;
}

/**
 * 计算链接密度
 */
export function calculateLinkDensity(node: Node, $: CheerioAPI): number {
  const $node = $(node);
  const text = $node.text().trim();
  const linkText = $node.find('a').text().trim();
  
  if (!text) return 0;
  return linkText.length / text.length;
}

/**
 * 计算节点得分
 */
export function scoreElement($: CheerioAPI, element: Node): number {
  const $elem = $(element);
  let score = 0;
  
  // 根据标签调整分数
  const tagName = element.tagName?.toLowerCase();
  if (tagName) {
    switch (tagName) {
      case 'article':
        score += 30;
        break;
      case 'section':
        score += 25;
        break;
      case 'main':
        score += 20;
        break;
      case 'div':
        score += 5;
        break;
      case 'p':
        score += 3;
        break;
      case 'pre':
        score += 3;
        break;
      case 'blockquote':
        score += 3;
        break;
      case 'td':
        score -= 3;
        break;
      case 'form':
        score -= 10;
        break;
      case 'ol':
      case 'ul':
        score += 3;
        break;
      case 'li':
        score += 1;
        break;
    }
  }
  
  // 根据类名和ID调整分数
  const classAndId = `${$elem.attr('class')} ${$elem.attr('id')}`.toLowerCase();
  
  // 正面特征
  if (/article|content|post|text|body/g.test(classAndId)) {
    score += 25;
  }
  if (/main|primary/g.test(classAndId)) {
    score += 20;
  }
  if (/entry|story|blog/g.test(classAndId)) {
    score += 15;
  }
  
  // 负面特征
  if (/comment|meta|footer|footnote/g.test(classAndId)) {
    score -= 20;
  }
  if (/sidebar|widget|share|social|nav|menu/g.test(classAndId)) {
    score -= 15;
  }
  if (/advertisement|banner|ad-/g.test(classAndId)) {
    score -= 30;
  }
  
  // 根据内容调整分数
  const text = $elem.text();
  const textLength = calculateTextLength(text);
  score += Math.min(Math.floor(textLength / 100), 30);
  
  // 根据链接密度调整分数
  const linkDensity = calculateLinkDensity(element, $);
  score *= (1 - linkDensity);
  
  // 根据图片调整分数
  const imgs = $elem.find('img');
  if (imgs.length > 0) {
    score += Math.min(imgs.length * 5, 20);
  }
  
  // 根据段落调整分数
  const paragraphs = $elem.find('p');
  if (paragraphs.length > 0) {
    score += Math.min(paragraphs.length * 3, 30);
  }
  
  // 根据标题调整分数
  const headings = $elem.find('h1, h2, h3, h4, h5, h6');
  if (headings.length > 0) {
    score += Math.min(headings.length * 5, 20);
  }
  
  return score;
}

/**
 * 规范化HTML
 */
export function normalizeHtml($: CheerioAPI, element: Node): void {
  const $elem = $(element);
  
  // 规范化空白字符
  $elem.contents().each((index: number, node: Node) => {
    if (node.type === 'text') {
      const text = $(node).text();
      if (text.trim()) {
        node.data = text.replace(/\s+/g, ' ').trim();
      }
    }
  });
  
  // 合并相邻的文本节点
  $elem.contents().each((index: number, node: Node) => {
    if (node.next && node.type === 'text' && node.next.type === 'text') {
      node.data = `${node.data} ${node.next.data}`.trim();
      $(node.next).remove();
    }
  });
  
  // 规范化图片
  $elem.find('img').each((index: number, img: Node) => {
    const $img = $(img);
    $img.attr('loading', 'lazy');
    if (!$img.attr('alt')) {
      $img.attr('alt', '');
    }
  });
  
  // 规范化链接
  $elem.find('a').each((index: number, link: Node) => {
    const $link = $(link);
    if (!$link.attr('href')) {
      $link.removeAttr('href');
    }
    $link.attr('rel', 'noopener');
    if ($link.attr('target') === '_blank') {
      $link.attr('rel', 'noopener noreferrer');
    }
  });
  
  // 规范化表格
  $elem.find('table').each((index: number, table: Node) => {
    const $table = $(table);
    
    // 添加thead
    if (!$table.find('thead').length && $table.find('tr').length) {
      const $firstRow = $table.find('tr').first();
      $firstRow.find('td').each((index: number, cell: Node) => {
        const $cell = $(cell);
        $cell.replaceWith(`<th>${$cell.html()}</th>`);
      });
      $firstRow.wrap('<thead>');
    }
    
    // 添加tbody
    const $tbody = $table.find('tbody');
    if (!$tbody.length) {
      $table.find('tr:not(thead tr)').wrapAll('<tbody>');
    }
  });
}