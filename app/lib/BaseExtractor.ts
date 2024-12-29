import * as cheerio from 'cheerio';
import { type CheerioAPI, type CheerioNode, type CheerioElement, type AnyNode, asCheerioNode, asElement } from '../types/cheerio';
import { ExtractResult, ExtractorOptions, CONTENT_SELECTORS, NOISE_SELECTORS } from '../types/extractor';
import { calculateTextLength, cleanHtml, scoreElement } from '../utils/extractor';
import { TitleExtractor } from './extractors/TitleExtractor';

export class BaseExtractor {
  protected options: Required<ExtractorOptions>;
  protected $!: CheerioAPI;
  private titleExtractor: TitleExtractor;
  private droppedNodes: Set<CheerioNode>;
  
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
      normalizeWhitespace: true,
      decodeEntities: true
    });
    
    // 清理文档
    this.cleanDocument();
    
    // 提取标题
    const title = this.extractTitle();
    
    // 提取主要内容
    const mainContent = this.extractMainContent();
    
    // 后处理
    this.postProcess(mainContent);
    
    // 获取处理后的内容
    const $content = this.$(asElement(mainContent));
    const content = $content.html() || '';
    const textContent = $content.text().trim();
    
    return {
      title,
      content,
      textContent,
      html,
      url
    };
  }
  
  /**
   * 清理文档
   */
  protected cleanDocument(): void {
    // 移除噪音节点
    this.removeNoiseNodes();
    // 清理空节点
    this.cleanEmptyNodes();
    // 规范化内容
    this.normalizeContent();
  }
  
  protected removeNoiseNodes(): void {
    // 移除通用噪音
    NOISE_SELECTORS.forEach(selector => {
      this.$(selector).each((_: number, elem: CheerioElement) => {
        const node = asCheerioNode(elem);
        if (!this.shouldKeepNode(node)) {
          this.removeNode(node);
        }
      });
    });

    // 移除隐藏元素
    this.$('[style*="display: none"], [style*="visibility: hidden"]').remove();
    
    // 移除空的或无意义的元素
    this.$('div:empty, p:empty, span:empty').remove();
  }
  
  protected shouldKeepNode(node: CheerioNode): boolean {
    const $ = this.$;
    const $node = $(asElement(node));
    
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
  
  protected cleanEmptyNodes(): void {
    const $ = this.$;
    
    $('*').each(function(this: AnyNode) {
      const $elem = $(this);
      const text = $elem.text().trim();
      
      if (!text && !$elem.find('img, video, iframe').length) {
        $elem.remove();
      }
    });
  }
  
  protected normalizeContent(): void {
    const $ = this.$;
    
    // 规范化空白字符
    $('*').contents().each(function(this: AnyNode) {
      const node = asCheerioNode(this);
      if (node.type === 'text') {
        const text = $(this).text();
        node.data = text.replace(/\s+/g, ' ').trim();
      }
    });
    
    // 合并相邻的文本节点
    $('*').contents().each(function(this: AnyNode) {
      const node = asCheerioNode(this);
      if (node.next && node.type === 'text' && node.next.type === 'text') {
        node.data = `${node.data} ${node.next.data}`.trim();
        $(asElement(node.next)).remove();
      }
    });
  }
  
  protected extractTitle(): string {
    return this.titleExtractor.extract(this.$);
  }
  
  protected extractMainContent(): CheerioNode {
    // 尝试使用自定义选择器
    const customSelectors = this.getCustomSelectors();
    for (const selector of customSelectors) {
      const element = this.$(selector);
      if (element.length && this.isValidContent(asCheerioNode(element.get(0) as CheerioElement))) {
        return asCheerioNode(element.get(0) as CheerioElement);
      }
    }
    
    // 尝试使用通用选择器
    for (const selector of CONTENT_SELECTORS) {
      const element = this.$(selector);
      if (element.length && this.isValidContent(asCheerioNode(element.get(0) as CheerioElement))) {
        return asCheerioNode(element.get(0) as CheerioElement);
      }
    }
    
    // 如果没有找到合适的内容,返回body
    return asCheerioNode(this.$('body').get(0) as CheerioElement);
  }
  
  protected getCustomSelectors(): string[] {
    return [];
  }
  
  protected isValidContent(element: CheerioNode): boolean {
    const $ = this.$;
    const $elem = $(asElement(element));
    
    // 检查标签名
    if (!element.tagName) return false;
    const tagName = element.tagName.toLowerCase();
    
    // 排除不合适的标签
    const excludeTags = ['nav', 'header', 'footer', 'aside'];
    if (excludeTags.includes(tagName)) {
      return false;
    }
    
    // 检查文本长度和链接密度
    const text = $elem.text().trim();
    const textLength = calculateTextLength($, element);
    const linkNode = $elem.find('a').get(0);
    const linkLength = linkNode ? calculateTextLength($, asCheerioNode(linkNode as CheerioElement)) : 0;
    
    if (textLength < this.options.minTextLength) {
      return false;
    }
    
    const linkDensity = linkLength / textLength;
    if (linkDensity > 0.5) {
      return false;
    }
    
    return true;
  }
  
  protected removeNode(node: CheerioNode): void {
    const $ = this.$;
    const $elem = $(asElement(node));
    
    // 检查是否已经被移除
    if (this.droppedNodes.has(node)) {
      return;
    }
    
    // 检查文本内容
    const text = $elem.text().trim();
    const textLength = calculateTextLength($, node);
    
    // 检查链接密度
    const linkText = $elem.find('a').text().trim();
    const linkNode = $elem.find('a').get(0);
    const linkLength = linkNode ? calculateTextLength($, asCheerioNode(linkNode as CheerioElement)) : 0;
    const linkDensity = linkLength / textLength;
    
    // 如果链接密度过高或文本长度过短,移除节点
    if (linkDensity > 0.5 || textLength < this.options.minTextLength) {
      $elem.remove();
      this.droppedNodes.add(node);
    }
  }
  
  protected postProcess(element: CheerioNode): void {
    const $ = this.$;
    const $elem = $(asElement(element));
    
    // 移除空节点
    $elem.find('*:empty').remove();
    
    // 处理图片
    $elem.find('img').each((_: number, img: CheerioElement) => {
      const $img = $(img);
      const src = $img.attr('src');
      const dataSrc = $img.attr('data-src');
      
      if (!src && dataSrc) {
        $img.attr('src', dataSrc);
      }
    });
    
    // 处理链接
    $elem.find('a').each((_: number, link: CheerioElement) => {
      const $link = $(link);
      const href = $link.attr('href');
      
      if (href?.startsWith('http')) {
        $link.attr('target', '_blank');
        $link.attr('rel', 'noopener noreferrer');
      }
    });
  }
}