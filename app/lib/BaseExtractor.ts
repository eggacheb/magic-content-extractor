import * as cheerio from 'cheerio';
import { type CheerioAPI, type CheerioNode, type CheerioElement, type AnyNode, asCheerioNode, asElement } from '../types/cheerio';
import { ExtractResult, ExtractorOptions, CONTENT_SELECTORS, NOISE_SELECTORS } from '../types/extractor';
import { calculateTextLength, cleanHtml, scoreElement } from '../utils/extractor';
import { TitleExtractor } from './extractors/TitleExtractor';

// 标签权重配置
const TAG_WEIGHTS: { [key: string]: number } = {
  article: 10,
  main: 8,
  section: 6,
  div: 4,
  p: 3,
  pre: 3,
  code: 3,
  blockquote: 2,
  figure: 2,
  table: 2,
};

// 正面类名权重
const POSITIVE_CLASS_WEIGHTS: { [key: string]: number } = {
  article: 8,
  content: 8,
  post: 6,
  entry: 6,
  text: 4,
  body: 4,
};

// 负面类名权重
const NEGATIVE_CLASS_WEIGHTS: { [key: string]: number } = {
  sidebar: -8,
  comment: -6,
  advertisement: -8,
  ad: -8,
  nav: -6,
  footer: -6,
  header: -4,
};

// 需要保留的属性
const KEEP_ATTRIBUTES = [
  'src',
  'href',
  'title',
  'alt',
  'class',
  'id',
  'name',
  'content',
  'data-src',
  'data-original',
];

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
      if ('type' in node && node.type === 'text' && 'data' in node) {
        const text = $(this).text();
        node.data = text.replace(/\s+/g, ' ').trim();
      }
    });
    
    // 合并相邻的文本节点
    $('*').contents().each(function(this: AnyNode) {
      const node = asCheerioNode(this);
      if (node.next && 'type' in node && node.type === 'text' && 
          'type' in node.next && node.next.type === 'text' &&
          'data' in node && 'data' in node.next) {
        node.data = `${node.data} ${node.next.data}`.trim();
        if (node.next.parent) {
          const parent = asElement(node.next.parent);
          $(parent).find(`*:contains("${node.next.data}")`).first().remove();
        }
      }
    });
  }
  
  protected extractTitle(): string {
    return this.titleExtractor.extract(this.$);
  }
  
  protected extractMainContent(): CheerioNode {
    // 1. 尝试使用XPath提取
    const xpathResult = this.extractByXPath();
    if (xpathResult) {
      return xpathResult;
    }
    
    // 2. 尝试使用自定义选择器
    const customSelectors = this.getCustomSelectors();
    for (const selector of customSelectors) {
      const element = this.$(selector);
      if (element.length && this.isValidContent(asCheerioNode(element.get(0) as CheerioElement))) {
        return asCheerioNode(element.get(0) as CheerioElement);
      }
    }
    
    // 3. 尝试使用通用选择器
    for (const selector of CONTENT_SELECTORS) {
      const element = this.$(selector);
      if (element.length && this.isValidContent(asCheerioNode(element.get(0) as CheerioElement))) {
        return asCheerioNode(element.get(0) as CheerioElement);
      }
    }
    
    // 4. 使用启发式算法查找最佳节点
    const bestNode = this.findBestNode();
    if (bestNode) {
      return bestNode;
    }
    
    // 5. 如果都失败了,返回body
    return asCheerioNode(this.$('body').get(0) as CheerioElement);
  }
  
  protected getCustomSelectors(): string[] {
    return [];
  }
  
  /**
   * 计算节点得分
   */
  protected calculateNodeScore(node: CheerioNode): number {
    if (!node.tagName) return 0;
    const $ = this.$;
    const $node = $(asElement(node));
    let score = 0;

    // 1. 标签权重
    const tagName = node.tagName.toLowerCase();
    score += TAG_WEIGHTS[tagName] || 0;

    // 2. 类名权重
    const classNames = $node.attr('class')?.split(/\s+/) || [];
    for (const className of classNames) {
      const lowerClassName = className.toLowerCase();
      score += POSITIVE_CLASS_WEIGHTS[lowerClassName] || 0;
      score += NEGATIVE_CLASS_WEIGHTS[lowerClassName] || 0;
    }

    // 3. 内容特征评分
    const text = $node.text().trim();
    const textLength = calculateTextLength($, node);
    const linkNode = $node.find('a').get(0);
    const linkLength = linkNode ? calculateTextLength($, asCheerioNode(linkNode as CheerioElement)) : 0;
    const linkDensity = linkLength / (textLength || 1);

    // 文本长度得分
    score += Math.min(Math.floor(textLength / 100), 10);
    
    // 链接密度惩罚
    if (linkDensity > 0.5) {
      score -= Math.floor(linkDensity * 10);
    }

    // 图片奖励
    const imageCount = $node.find('img').length;
    score += Math.min(imageCount * 2, 8);

    // 段落奖励
    const paragraphCount = $node.find('p').length;
    score += Math.min(paragraphCount, 5);

    // 标题奖励
    const headingCount = $node.find('h1, h2, h3, h4, h5, h6').length;
    score += Math.min(headingCount * 2, 6);

    return score;
  }

  /**
   * 清理节点属性
   */
  protected cleanAttributes(node: CheerioNode): void {
    if (!node.tagName) return;
    const $ = this.$;
    const $node = $(asElement(node));
    
    // 获取所有属性
    const attributes = $node.get(0)?.attribs || {};
    
    // 移除不需要的属性
    for (const attr in attributes) {
      if (!KEEP_ATTRIBUTES.includes(attr.toLowerCase())) {
        $node.removeAttr(attr);
      }
    }
    
    // 递归处理子节点
    $node.children().each((_: number, child: CheerioElement) => {
      this.cleanAttributes(asCheerioNode(child));
    });
  }

  /**
   * 增强的内容验证
   */
  protected isValidContent(element: CheerioNode): boolean {
    const $ = this.$;
    const $elem = $(asElement(element));
    
    // 基本检查
    if (!element.tagName) return false;
    const tagName = element.tagName.toLowerCase();
    
    // 排除不合适的标签
    const excludeTags = ['nav', 'header', 'footer', 'aside', 'style', 'script', 'meta', 'link'];
    if (excludeTags.includes(tagName)) {
      return false;
    }
    
    // 计算节点得分
    const score = this.calculateNodeScore(element);
    if (score < this.options.minScore) {
      return false;
    }
    
    // 检查文本长度和链接密度
    const textLength = calculateTextLength($, element);
    if (textLength < this.options.minTextLength) {
      return false;
    }
    
    const linkNode = $elem.find('a').get(0);
    const linkLength = linkNode ? calculateTextLength($, asCheerioNode(linkNode as CheerioElement)) : 0;
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
    
    // 清理属性
    this.cleanAttributes(element);
    
    // 移除空节点
    $elem.find('*:empty').remove();
    
    // 规范化内容
    this.normalizeContent();
    
    // 处理特殊标签
    this.processSpecialTags($elem);
    
    // 处理数学公式
    this.processMathFormulas($elem);
    
    // 处理引用和注释
    this.processQuotesAndNotes($elem);
  }

  /**
   * 处理数学公式
   */
  protected processMathFormulas($elem: cheerio.Cheerio<CheerioElement>): void {
    const $ = this.$;
    
    // 处理行内公式
    $elem.find('span.math-inline, .MathJax_Preview').each((_index: number, math: CheerioElement) => {
      const $math = $(math);
      const tex = $math.text().trim();
      if (tex.length > 0) {
        // 保留原始TeX代码
        $math.attr('data-tex', tex);
        // 添加公式类
        $math.addClass('math-inline');
      }
    });
    
    // 处理块级公式
    $elem.find('div.math-display, .MathJax_Display').each((_index: number, math: CheerioElement) => {
      const $math = $(math);
      const tex = $math.text().trim();
      if (tex.length > 0) {
        // 保留原始TeX代码
        $math.attr('data-tex', tex);
        // 添加公式类
        $math.addClass('math-display');
      }
    });
    
    // 处理LaTeX格式的公式
    const processNode = (node: CheerioElement) => {
      const cheerioNode = asCheerioNode(node);
      if ('type' in cheerioNode && cheerioNode.type === 'text' && 'data' in cheerioNode) {
        const nodeData = cheerioNode.data || '';
        let text: string = nodeData;
        let changed = false;
        
        // 处理行内公式 $...$
        const processInlineMath = (formula: string) => {
          changed = true;
          return `<span class="math-inline" data-tex="${formula}">$${formula}$</span>`;
        };
        text = text.replace(/\$([^\$]+)\$/g, (_match: string, formula: string) => processInlineMath(formula));
        
        // 处理块级公式 $$...$$
        const processDisplayMath = (formula: string) => {
          changed = true;
          return `<div class="math-display" data-tex="${formula}">$$${formula}$$</div>`;
        };
        text = text.replace(/\$\$([^\$]+)\$\$/g, (_match: string, formula: string) => processDisplayMath(formula));
        
        // 处理 \begin{equation}...\end{equation}
        const processEquation = (formula: string) => {
          changed = true;
          return `<div class="math-display" data-tex="${formula}">\\begin{equation}${formula}\\end{equation}</div>`;
        };
        text = text.replace(/\\begin{equation}([\s\S]*?)\\end{equation}/g, (_match: string, formula: string) => processEquation(formula));
        
        // 处理 \begin{align}...\end{align}
        const processAlign = (formula: string) => {
          changed = true;
          return `<div class="math-display" data-tex="${formula}">\\begin{align}${formula}\\end{align}</div>`;
        };
        text = text.replace(/\\begin{align}([\s\S]*?)\\end{align}/g, (_match: string, formula: string) => processAlign(formula));
        
        if (changed) {
          const $newContent = $(text);
          if ($newContent.length > 0) {
            $(node).replaceWith($newContent);
          }
        }
      }
    };

    // 遍历所有节点处理公式
    const traverse = (element: CheerioElement) => {
      const children = $(element).contents().toArray() as CheerioElement[];
      for (const child of children) {
        processNode(child);
        if ('type' in child && child.type === 'tag') {
          traverse(child);
        }
      }
    };

    const firstElement = $elem.get(0);
    if (firstElement) {
      traverse(firstElement);
    }
  }

  /**
   * 处理引用和注释
   */
  protected processQuotesAndNotes($elem: cheerio.Cheerio<CheerioElement>): void {
    const $ = this.$;
    
    // 处理块引用
    $elem.find('blockquote').each((_: number, quote: CheerioElement) => {
      const $quote = $(quote);
      // 添加引用样式类
      $quote.addClass('content-quote');
      // 处理引用来源
      const $cite = $quote.find('cite');
      if ($cite.length) {
        $cite.addClass('quote-source');
      }
    });
    
    // 处理脚注
    $elem.find('.footnote, .reference').each((_: number, note: CheerioElement) => {
      const $note = $(note);
      // 规范化脚注样式
      $note.addClass('content-footnote');
      // 处理脚注链接
      $note.find('a').each((_: number, link: CheerioElement) => {
        const $link = $(link);
        const href = $link.attr('href');
        if (href?.startsWith('#')) {
          $link.addClass('footnote-link');
        }
      });
    });
    
    // 处理旁注
    $elem.find('.sidenote, .marginnote').each((_: number, note: CheerioElement) => {
      const $note = $(note);
      // 规范化旁注样式
      $note.addClass('content-sidenote');
    });
  }

  /**
   * 处理特殊标签
   */
  protected processSpecialTags($elem: cheerio.Cheerio<CheerioElement>): void {
    const $ = this.$;
    
    // 处理表格
    $elem.find('table').each((_: number, table: CheerioElement) => {
      const $table = $(table);
      // 确保第一行是表头
      const $firstRow = $table.find('tr').first();
      $firstRow.find('td').each((_: number, cell: CheerioElement) => {
        const $cell = $(cell);
        $cell.replaceWith(`<th>${$cell.html() || ''}</th>`);
      });
      // 添加响应式包装
      $table.wrap('<div class="table-responsive"></div>');
      // 添加表格样式类
      $table.addClass('content-table');
    });
    
    // 处理代码块
    $elem.find('pre, code').each((_: number, code: CheerioElement) => {
      const $code = $(code);
      // 保留代码格式
      const html = $code.html();
      if (html) {
        // 处理代码高亮
        const lang = $code.attr('class')?.match(/language-(\w+)/)?.[1];
        if (lang) {
          $code.attr('data-language', lang);
        }
        // 保留换行和空格
        $code.html(html.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;'));
      }
      // 添加代码样式类
      $code.addClass('content-code');
    });
    
    // 处理图片
    $elem.find('img').each((_: number, img: CheerioElement) => {
      const $img = $(img);
      // 处理懒加载
      const dataSrc = $img.attr('data-src') || $img.attr('data-original');
      if (dataSrc) {
        $img.attr('src', dataSrc);
      }
      // 处理图片说明
      const alt = $img.attr('alt');
      if (alt) {
        $img.wrap('<figure class="content-figure"></figure>');
        $img.after(`<figcaption class="figure-caption">${alt}</figcaption>`);
      }
      // 添加响应式类
      $img.addClass('img-fluid content-image');
    });
  }

  /**
   * 使用XPath提取内容
   */
  protected extractByXPath(): CheerioNode | null {
    const $ = this.$;
    
    // 常用的内容XPath表达式
    const CONTENT_XPATHS = [
      "//article[contains(@class, 'content') or contains(@class, 'article')]",
      "//div[contains(@class, 'content') or contains(@class, 'article')]",
      "//main[contains(@class, 'content') or contains(@class, 'main')]",
      "//section[contains(@class, 'content') or contains(@class, 'article')]",
      "//div[@id='content' or @id='article' or @id='main-content']",
      "//div[contains(@class, 'post') or contains(@class, 'entry')]",
    ];
    
    for (const xpath of CONTENT_XPATHS) {
      try {
        // 使用Cheerio的find方法模拟XPath
        const elements = $(xpath.replace(/\/\//g, '').replace(/\[\@/g, '['));
        if (elements.length > 0) {
          const node = asCheerioNode(elements.get(0) as CheerioElement);
          if (this.isValidContent(node)) {
            return node;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    return null;
  }

  /**
   * 使用启发式算法查找最佳节点
   */
  protected findBestNode(): CheerioNode | null {
    const $ = this.$;
    let bestNode: CheerioNode | null = null;
    let maxScore = -1;
    
    // 遍历所有可能的内容节点
    $('div, article, section, main').each((_: number, element: CheerioElement) => {
      const node = asCheerioNode(element);
      
      // 跳过已经被排除的节点
      if (this.droppedNodes.has(node)) {
        return;
      }
      
      // 计算节点得分
      const score = this.calculateContentScore(node);
      
      // 更新最佳节点
      if (score > maxScore) {
        maxScore = score;
        bestNode = node;
      }
    });
    
    return bestNode && this.isValidContent(bestNode) ? bestNode : null;
  }

  /**
   * 计算内容得分
   */
  protected calculateContentScore(node: CheerioNode): number {
    const $ = this.$;
    const $node = $(asElement(node));
    let score = this.calculateNodeScore(node);
    
    // 1. 文本密度得分
    const textLength = calculateTextLength($, node);
    const nodeHtml = $node.html();
    const nodeLength = nodeHtml ? nodeHtml.length : 0;
    const textDensity = textLength / (nodeLength || 1);
    score += textDensity * 10;
    
    // 2. 段落质量得分
    const paragraphs = $node.find('p');
    let paragraphScore = 0;
    paragraphs.each((_index: number, p: CheerioElement) => {
      const $p = $(p);
      const pText = $p.text().trim() || '';
      // 长段落加分
      if (pText.length > 50) {
        paragraphScore += 2;
      }
      // 包含标点符号加分
      if (/[.。!！?？]/.test(pText)) {
        paragraphScore += 1;
      }
    });
    score += Math.min(paragraphScore, 30);
    
    // 3. 内容多样性得分
    const hasImages = $node.find('img').length > 0;
    const hasTables = $node.find('table').length > 0;
    const hasLists = $node.find('ul, ol').length > 0;
    const hasCode = $node.find('pre, code').length > 0;
    score += (hasImages ? 5 : 0) + (hasTables ? 5 : 0) + (hasLists ? 3 : 0) + (hasCode ? 3 : 0);
    
    // 4. 位置得分
    const depth = $node.parents().length;
    score -= depth; // 层级越深分数越低
    
    // 5. 链接密度惩罚
    const links = $node.find('a');
    const linkText = links.text().trim() || '';
    const linkLength = linkText.length;
    const linkDensity = linkLength / (textLength || 1);
    score -= linkDensity * 20;
    
    // 6. 关键词加分
    const html = nodeHtml ? nodeHtml.toLowerCase() : '';
    const keywords = ['article', 'content', 'post', 'entry', 'main', 'text'];
    keywords.forEach((keyword: string) => {
      if (html.includes(keyword)) {
        score += 2;
      }
    });
    
    return Math.max(0, score);
  }
}