import * as cheerio from 'cheerio';
import type { CheerioAPI, AnyNode, Cheerio } from '@types/cheerio';
import { defaultConfig } from '../config/extractor';
import {
  calculateTextLength,
  cleanHtml,
  isPreservableNode,
  hasValidContent,
  calculateLinkDensity,
  scoreElement,
  normalizeHtml,
} from './extractor';

export class ReadabilityPlus {
  private $: CheerioAPI;
  private config = defaultConfig;
  private candidates: Map<AnyNode, number> = new Map();
  private articleContent: AnyNode | null = null;
  
  constructor(html: string) {
    this.$ = cheerio.load(html);
    this.initialize();
  }
  
  /**
   * 初始化处理
   */
  private initialize(): void {
    // 清理 HTML
    cleanHtml(this.$, {
      removeScripts: true,
      removeStyles: true,
      removeComments: true,
    });
    
    // 预处理内容
    this.preprocessContent();
    
    // 查找文章内容
    this.findContent();
    
    // 后处理内容
    if (this.articleContent) {
      this.postprocessContent();
    }
  }
  
  /**
   * 预处理内容
   */
  private preprocessContent(): void {
    // 移除不需要的标签
    this.config.clean.removeTags.forEach(tag => {
      this.$(tag).remove();
    });
    
    // 移除不需要的类
    this.config.clean.removeClasses.forEach(className => {
      this.$(`.${className}`).remove();
    });
    
    // 清理属性
    this.$('*').each((index: number, elem: AnyNode) => {
      const attributes = elem.attribs || {};
      for (const attr in attributes) {
        if (!this.config.clean.keepAttributes.includes(attr)) {
          this.$(elem).removeAttr(attr);
        }
      }
    });
  }
  
  /**
   * 查找文章内容
   */
  private findContent(): void {
    // 首先尝试使用选择器
    for (const selector of this.config.selectors.article) {
      const element = this.$(selector).first();
      if (element.length && hasValidContent(element[0], this.$)) {
        this.articleContent = element[0];
        return;
      }
    }
    
    // 如果选择器没有找到，使用评分系统
    this.$('*').each((index: number, elem: AnyNode) => {
      if (this.shouldScore(elem)) {
        const score = scoreElement(this.$, elem);
        if (score > 0) {
          this.candidates.set(elem, score);
        }
      }
    });
    
    // 选择得分最高的元素
    let maxScore = 0;
    this.candidates.forEach((score, elem) => {
      if (score > maxScore) {
        maxScore = score;
        this.articleContent = elem;
      }
    });
  }
  
  /**
   * 判断是否需要评分
   */
  private shouldScore(node: AnyNode): boolean {
    // 检查是否是元素节点
    if (!node.tagName) return false;
    
    // 检查是否是需要移除的标签
    if (this.config.clean.removeTags.includes(node.tagName.toLowerCase())) {
      return false;
    }
    
    // 检查是否有足够的内容
    return hasValidContent(node, this.$);
  }
  
  /**
   * 后处理内容
   */
  private postprocessContent(): void {
    if (!this.articleContent) return;
    
    const $content = this.$(this.articleContent);
    
    // 规范化 HTML
    normalizeHtml(this.$, this.articleContent);
    
    // 处理特殊内容
    this.processSpecialContent($content);
    
    // 清理无用内容
    this.cleanupContent($content);
    
    // 优化图片
    this.optimizeImages($content);
    
    // 优化链接
    this.optimizeLinks($content);
  }
  
  /**
   * 处理特殊内容
   */
  private processSpecialContent($content: Cheerio<AnyNode>): void {
    // 处理数学公式
    const { math } = this.config.special;
    $content.find(':contains("$")').each((index: number, elem: AnyNode) => {
      let html = this.$(elem).html() || '';
      
      // 处理块级公式
      math.block.forEach(pattern => {
        html = html.replace(new RegExp(pattern, 'g'), (match: string) => {
          return `<div class="math-block">${match}</div>`;
        });
      });
      
      // 处理行内公式
      math.inline.forEach(pattern => {
        html = html.replace(new RegExp(pattern, 'g'), (match: string) => {
          return `<span class="math-inline">${match}</span>`;
        });
      });
      
      this.$(elem).html(html);
    });
    
    // 处理代码块
    const { code } = this.config.special;
    $content.find(':contains("`"), :contains("<code>")').each((index: number, elem: AnyNode) => {
      let html = this.$(elem).html() || '';
      
      // 处理块级代码
      code.block.forEach(pattern => {
        html = html.replace(new RegExp(pattern, 'g'), (match: string) => {
          return `<pre><code>${match}</code></pre>`;
        });
      });
      
      // 处理行内代码
      code.inline.forEach(pattern => {
        html = html.replace(new RegExp(pattern, 'g'), (match: string) => {
          return `<code>${match}</code>`;
        });
      });
      
      this.$(elem).html(html);
    });
    
    // 处理表格
    const { table } = this.config.special;
    $content.find(table.selectors.join(',')).each((index: number, elem: AnyNode) => {
      const $table = this.$(elem);
      
      // 添加缺失的表头
      if (!$table.find('thead').length && $table.find('tr').length) {
        const $firstRow = $table.find('tr').first();
        $firstRow.find('td').each((index: number, cell: AnyNode) => {
          const $cell = this.$(cell);
          $cell.replaceWith(`<th>${$cell.html()}</th>`);
        });
        $firstRow.wrap('<thead>');
      }
      
      // 添加缺失的表体
      if (!$table.find('tbody').length) {
        $table.find('tr:not(thead tr)').wrapAll('<tbody>');
      }
    });
  }
  
  /**
   * 清理无用内容
   */
  private cleanupContent($content: Cheerio<AnyNode>): void {
    // 移除空节点
    $content.find('*').each((index: number, elem: AnyNode) => {
      const $elem = this.$(elem);
      if (!$elem.contents().length && !isPreservableNode(elem)) {
        $elem.remove();
      }
    });
    
    // 移除链接密度过高的节点
    $content.find('*').each((index: number, elem: AnyNode) => {
      const linkDensity = calculateLinkDensity(elem, this.$);
      if (linkDensity > this.config.thresholds.maxLinkDensity) {
        this.$(elem).remove();
      }
    });
  }
  
  /**
   * 优化图片
   */
  private optimizeImages($content: Cheerio<AnyNode>): void {
    $content.find('img').each((index: number, img: AnyNode) => {
      const $img = this.$(img);
      
      // 添加延迟加载
      $img.attr('loading', 'lazy');
      
      // 添加 alt 属性
      if (!$img.attr('alt')) {
        $img.attr('alt', '');
      }
      
      // 移除无效的图片
      if (!$img.attr('src')) {
        $img.remove();
      }
    });
  }
  
  /**
   * 优化链接
   */
  private optimizeLinks($content: Cheerio<AnyNode>): void {
    $content.find('a').each((index: number, link: AnyNode) => {
      const $link = this.$(link);
      
      // 移除无效的链接
      if (!$link.attr('href')) {
        $link.removeAttr('href');
      }
      
      // 添加安全属性
      $link.attr('rel', 'noopener');
      if ($link.attr('target') === '_blank') {
        $link.attr('rel', 'noopener noreferrer');
      }
    });
  }
  
  /**
   * 获取文章内容
   */
  public getContent(): string {
    if (!this.articleContent) return '';
    return this.$(this.articleContent).html() || '';
  }
  
  /**
   * 获取文章文本
   */
  public getText(): string {
    if (!this.articleContent) return '';
    return this.$(this.articleContent).text().trim();
  }
  
  /**
   * 获取文章标题
   */
  public getTitle(): string {
    // 尝试使用选择器查找标题
    for (const selector of this.config.selectors.title) {
      const title = this.$(selector).first().text().trim();
      if (title) return title;
    }
    return '';
  }
  
  /**
   * 获取文章日期
   */
  public getDate(): string {
    // 尝试使用选择器查找日期
    for (const selector of this.config.selectors.date) {
      const $date = this.$(selector).first();
      
      // 尝试获取 datetime 属性
      const datetime = $date.attr('datetime') || $date.attr('pubdate');
      if (datetime) return datetime;
      
      // 尝试获取文本内容
      const dateText = $date.text().trim();
      if (dateText) return dateText;
    }
    return '';
  }
  
  /**
   * 获取文章作者
   */
  public getAuthor(): string {
    // 尝试使用选择器查找作者
    for (const selector of this.config.selectors.author) {
      const author = this.$(selector).first().text().trim();
      if (author) return author;
    }
    return '';
  }
} 