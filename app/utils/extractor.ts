import { type CheerioAPI, type CheerioNode, type CheerioElement, type AnyNode, asCheerioNode, asElement } from '../@types/cheerio';

export interface CleanOptions {
  removeScripts?: boolean;
  removeStyles?: boolean;
  removeComments?: boolean;
}

export function cleanHtml($: CheerioAPI, options: CleanOptions = {}): void {
  const {
    removeScripts = true,
    removeStyles = true,
    removeComments = true
  } = options;
  
  // 移除脚本
  if (removeScripts) {
    $('script').remove();
  }
  
  // 移除样式
  if (removeStyles) {
    $('style').remove();
    $('link[rel="stylesheet"]').remove();
  }
  
  // 移除注释
  if (removeComments) {
    $('*').contents().each(function(this: AnyNode) {
      const node = asCheerioNode(this);
      if (node.type === 'comment') {
        $(this).remove();
      }
    });
  }
}

export function calculateTextLength($: CheerioAPI, elem: CheerioNode): number {
  const $elem = $(asElement(elem));
  return $elem.text().trim().length;
}

export function isMediaNode(node: CheerioNode): boolean {
  return ['img', 'video', 'iframe', 'embed'].includes(node.tagName?.toLowerCase() || '');
}

export function hasVisibleContent($: CheerioAPI, node: CheerioNode): boolean {
  const $node = $(asElement(node));
  const text = $node.text().trim();
  const hasMedia = $node.find('img, video, iframe, embed').length > 0;
  return text.length > 0 || hasMedia;
}

export function hasValidLinks($: CheerioAPI, node: CheerioNode): boolean {
  const $node = $(asElement(node));
  const links = $node.find('a');
  let validLinks = 0;
  
  links.each((_: number, link: CheerioElement) => {
    const $link = $(link);
    const href = $link.attr('href');
    const text = $link.text().trim();
    
    if (href && text && !href.startsWith('#') && !href.startsWith('javascript:')) {
      validLinks++;
    }
  });
  
  return validLinks > 0;
}

export function scoreElement($: CheerioAPI, element: CheerioNode): number {
  const $elem = $(asElement(element));
  const tagName = element.tagName?.toLowerCase();
  let score = 0;
  
  // 基于标签的分数
  const tagScores: { [key: string]: number } = {
    article: 30,
    main: 25,
    section: 20,
    div: 5
  };
  
  score += tagScores[tagName || ''] || 0;
  
  // 基于类名和ID的分数
  const classAndId = ($elem.attr('class') || '') + ' ' + ($elem.attr('id') || '');
  const positivePatterns = [
    /article|post|content|text/i,
    /main|body/i,
    /entry|blog/i
  ];
  
  positivePatterns.forEach(pattern => {
    if (pattern.test(classAndId)) {
      score += 25;
    }
  });
  
  // 基于内容的分数
  const text = $elem.text().trim();
  const paragraphs = $elem.find('p').length;
  const images = $elem.find('img').length;
  
  score += Math.min(Math.floor(text.length / 100), 50);
  score += paragraphs * 5;
  score += images * 5;
  
  return score;
}

export function normalizeText($: CheerioAPI, element: CheerioNode): void {
  const $elem = $(asElement(element));
  
  // 规范化空白字符
  $elem.contents().each(function(this: AnyNode) {
    const node = asCheerioNode(this);
    if (node.type === 'text') {
      const text = $(this).text();
      node.data = text.replace(/\s+/g, ' ').trim();
    }
  });
  
  // 合并相邻的文本节点
  $elem.contents().each(function(this: AnyNode) {
    const node = asCheerioNode(this);
    if (node.next && node.type === 'text' && node.next.type === 'text') {
      node.data = `${node.data} ${node.next.data}`.trim();
      $(asElement(node.next)).remove();
    }
  });
}

export function normalizeMedia($: CheerioAPI, element: CheerioNode): void {
  const $elem = $(asElement(element));
  
  // 规范化图片
  $elem.find('img').each((_: number, img: CheerioElement) => {
    const $img = $(img);
    const src = $img.attr('src');
    const dataSrc = $img.attr('data-src');
    
    if (!src && dataSrc) {
      $img.attr('src', dataSrc);
    }
  });
  
  // 规范化链接
  $elem.find('a').each((_: number, link: CheerioElement) => {
    const $link = $(link);
    const href = $link.attr('href');
    
    if (href?.startsWith('http')) {
      $link.attr('target', '_blank');
      $link.attr('rel', 'noopener noreferrer');
    }
  });
  
  // 规范化表格
  $elem.find('table').each((_: number, table: CheerioElement) => {
    const $table = $(table);
    const $rows = $table.find('tr');
    
    if ($rows.length > 0) {
      const $firstRow = $($rows[0]);
      $firstRow.find('td').each((_: number, cell: CheerioElement) => {
        const $cell = $(cell);
        $cell.replaceWith(`<th>${$cell.html()}</th>`);
      });
    }
  });
}