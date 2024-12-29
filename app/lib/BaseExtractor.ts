import * as cheerio from 'cheerio';
import type { CheerioAPI, AnyNode, Cheerio } from 'cheerio';
import { ExtractResult, ExtractorOptions, CONTENT_SELECTORS, NOISE_SELECTORS } from '../types/extractor';
import { calculateTextLength, cleanHtml, scoreElement } from '../utils/extractor';
import { TitleExtractor } from './extractors/TitleExtractor';

export class BaseExtractor {
  protected options: Required<ExtractorOptions>;
  protected $!: CheerioAPI;
  private titleExtractor: TitleExtractor;
  private droppedNodes: Set<AnyNode>;
  
  constructor(options: ExtractorOptions = {}) {
    this.options = {
      minTextLength: 25,
      retryLength: 250,
      includeComments: false,
      minScore: 20,
      ...options
    };
    this.titleExtractor = new TitleExtractor();
    this.droppedNodes = new Set();
  }
  
  /**
   * 检查是否可以处理该URL
   */
  public canHandle(_url: string): boolean {
    return true;
  }
  
  /**
   * 提取内容
   */
  public async extract(html: string, url: string): Promise<ExtractResult> {
    this.$ = cheerio.load(html, {
      decodeEntities: true,
      normalizeWhitespace: true
    });
    
    // 清理文档
    this.cleanDocument();
    
    // 提取标题
    const title = this.extractTitle();
    
    // 提取主要内容
    const mainContent = this.extractMainContent();
    
    // 后处理
    this.postProcess(mainContent);
    
    // 获取内容
    const content = this.$(mainContent);
    const textContent = content.text().trim();
    const htmlContent = content.html() || '';

    return {
      title,
      content: htmlContent,
      textContent,
      html: htmlContent,
      url
    };
  }
  
  /**
   * 清理文档
   */
  protected cleanDocument(): void {
    // 基础清理
    cleanHtml(this.$, {
      removeScripts: true,
      removeStyles: true,
      removeComments: !this.options.includeComments
    });
    
    // 移除噪音元素
    this.removeNoiseNodes();
    
    // 清理空节点
    this.cleanEmptyNodes();
    
    // 规范化内容
    this.normalizeContent();
  }
  
  protected removeNoiseNodes(): void {
    // 移除通用噪音
    NOISE_SELECTORS.forEach(selector => {
      this.$(selector).each((_: number, elem: AnyNode) => {
        if (!this.shouldKeepNode(elem)) {
          this.removeNode(elem);
        }
      });
    });

    // 移除隐藏元素
    this.$('[style*="display: none"], [style*="visibility: hidden"]').remove();
    
    // 移除空的或无意义的元素
    this.$('div:empty, p:empty, span:empty').remove();
  }
  
  protected shouldKeepNode(node: AnyNode): boolean {
    const $ = this.$;
    const $node = $(node);
    
    // 检查是否包含重要内容
    if ($node.find('img, video, iframe').length > 0) {
      return true;
    }

    // 检查文本内容
    const text = $node.text().trim();
    if (text.length > this.options.minTextLength) {
      const linkText = $node.find('a').text().trim();
      const linkDensity = linkText.length / text.length;
      return linkDensity < 0.5;
    }

    return false;
  }
  
  protected removeNode(node: AnyNode): void {
    const $ = this.$;
    const $node = $(node);
    
    // 保存有价值的文本内容
    const tail = $node.next().text().trim();
    if (tail) {
      $node.after(` ${tail}`);
    }
    
    // 记录被移除的节点
    this.droppedNodes.add(node);
    
    // 移除节点
    $node.remove();
  }
  
  protected cleanEmptyNodes(): void {
    const $ = this.$;
    let removed: boolean;
    
    do {
      removed = false;
      $('*').each((_: number, elem: AnyNode) => {
        const $elem = $(elem);
        if (
          !$elem.contents().length && 
          !this.isPreservableNode(elem)
        ) {
          $elem.remove();
          removed = true;
        }
      });
    } while (removed);
  }
  
  protected isPreservableNode(node: AnyNode): boolean {
    return ['img', 'video', 'iframe', 'embed'].includes(node.tagName?.toLowerCase() || '');
  }
  
  protected normalizeContent(): void {
    const $ = this.$;
    
    // 规范化空白字符
    $('*').contents().each((_: number, node: AnyNode) => {
      if (node.type === 'text') {
        const text = $(node).text();
        if (text.trim()) {
          node.data = text.replace(/\s+/g, ' ').trim();
        }
      }
    });
    
    // 合并相邻的文本节点
    $('*').contents().each((_: number, node: AnyNode) => {
      if (node.next && node.type === 'text' && node.next.type === 'text') {
        node.data = `${node.data} ${node.next.data}`.trim();
        $(node.next).remove();
      }
    });
  }
  
  /**
   * 提取标题
   */
  protected extractTitle(): string {
    return this.titleExtractor.extract(this.$);
  }
  
  /**
   * 提取主要内容
   */
  protected extractMainContent(): AnyNode {
    let bestElement: AnyNode | null = null;
    let bestScore = -1;
    
    // 尝试预定义选择器
    const element = this.findBySelectors();
    if (element) {
      return element;
    }
    
    // 使用评分系统
    this.$('body *').each((_: number, elem: AnyNode) => {
      if (this.isValidContent(elem)) {
        const score = this.calculateContentScore(elem);
        if (score > bestScore) {
          bestScore = score;
          bestElement = elem;
        }
      }
    });
    
    return bestElement || this.$('body')[0];
  }
  
  protected findBySelectors(): AnyNode | null {
    const selectors = [...CONTENT_SELECTORS, ...this.getCustomSelectors()];
    
    for (const selector of selectors) {
      const element = this.$(selector).first();
      if (element.length && this.isValidContent(element[0])) {
        return element[0];
      }
    }
    
    return null;
  }
  
  protected calculateContentScore(element: AnyNode): number {
    const $ = this.$;
    const $elem = $(element);
    let score = scoreElement($, element);
    
    // 根据标签调整分数
    const tagName = element.tagName.toLowerCase();
    if (['article', 'main', 'section'].includes(tagName)) {
      score *= 1.5;
    }
    
    // 根据类名和ID调整分数
    const classAndId = `${$elem.attr('class')} ${$elem.attr('id')}`.toLowerCase();
    if (/article|content|post|main/g.test(classAndId)) {
      score *= 1.2;
    }
    if (/comment|meta|footer|sidebar/g.test(classAndId)) {
      score *= 0.8;
    }
    
    // 根据文本密度调整分数
    const textLength = calculateTextLength($elem.text());
    const linkLength = calculateTextLength($elem.find('a').text());
    const linkDensity = linkLength / (textLength || 1);
    score *= (1 - linkDensity);
    
    return score;
  }
  
  /**
   * 验证内容是否有效
   */
  protected isValidContent(element: AnyNode): boolean {
    const $ = this.$;
    const $elem = $(element);
    
    // 检查是否是无效标签
    const invalidTags = ['nav', 'aside', 'footer', 'header'];
    if (invalidTags.includes(element.tagName?.toLowerCase() || '')) {
      return false;
    }
    
    // 检查文本长度
    const text = $elem.text();
    const textLength = calculateTextLength(text);
    if (textLength < this.options.minTextLength) {
      return false;
    }
    
    // 检查链接密度
    const linkText = $elem.find('a').text();
    const linkLength = calculateTextLength(linkText);
    const linkDensity = linkLength / (textLength || 1);
    if (linkDensity > 0.5) {
      return false;
    }
    
    // 检查图片数量
    const imageCount = $elem.find('img').length;
    const density = textLength / (imageCount || 1);
    if (density < 100 && textLength < 200) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 获取自定义选择器
   */
  protected getCustomSelectors(): string[] {
    return [];
  }
  
  /**
   * 后处理
   */
  protected postProcess(element: AnyNode): void {
    const $ = this.$;
    const $elem = $(element);
    
    // 清理最终内容中的冗余元素
    $elem.find('script, style, link').remove();
    
    // 规范化图片
    $elem.find('img').each((_: number, img: AnyNode) => {
      const $img = $(img);
      const src = $img.attr('src');
      if (src) {
        $img.attr('loading', 'lazy');
        if (!$img.attr('alt')) {
          $img.attr('alt', '');
        }
      } else {
        $img.remove();
      }
    });
    
    // 规范化链接
    $elem.find('a').each((_: number, link: AnyNode) => {
      const $link = $(link);
      if (!$link.attr('href')) {
        $link.removeAttr('href');
      }
      $link.attr('rel', 'noopener');
      if ($link.attr('target') === '_blank') {
        $link.attr('rel', 'noopener noreferrer');
      }
    });
  }
}