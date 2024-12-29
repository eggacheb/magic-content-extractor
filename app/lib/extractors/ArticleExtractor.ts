import * as cheerio from 'cheerio';
import type { CheerioAPI, AnyNode, Cheerio } from 'cheerio';
import { BaseExtractor } from '../BaseExtractor';
import { ExtractResult } from '../../types/extractor';
import { cleanHtml } from '../../utils/extractor';

export class ArticleExtractor extends BaseExtractor {
  constructor() {
    super({
      minTextLength: 150,  // 文章内容通常较长
      minScore: 25,       // 文章评分要求更高
    });
  }

  public canHandle(url: string): boolean {
    // 排除明显的非文章页面
    const nonArticlePatterns = [
      /\/(tag|category|search|archive|author|page)\//, // 分类页面
      /\/(login|register|signup|signin)/, // 登录注册
      /\/(cart|checkout|shop|store)/, // 商店
      /\/(contact|about|faq|help)/, // 信息页
    ];

    return !nonArticlePatterns.some(pattern => pattern.test(url));
  }

  public async extract(html: string, url: string): Promise<ExtractResult> {
    // 预处理HTML
    html = this.preprocessHtml(html);
    
    // 初始化cheerio
    this.$ = this.initCheerio(html);
    
    // 获取base_url
    const baseUrl = this.getBaseUrl(url);
    
    // 特殊站点处理
    this.handleSpecialSites(url);
    
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
      url: baseUrl || url
    };
  }

  protected getCustomSelectors(): string[] {
    return [
      // 文章特定选择器
      '.article-content',
      '.post-content',
      '.entry-content',
      '.blog-post-content',
      '.news-content',
      // 内容区域选择器
      '#article-content',
      '#post-content',
      '#entry-content',
      '#main-content',
      // 自定义属性选择器
      '[itemprop="articleBody"]',
      '[property="og:description"]',
    ];
  }

  private preprocessHtml(html: string): string {
    return html
      .replace(/&nbsp;/g, ' ')
      .replace(/&#160;/g, ' ')
      .replace(/\s+/g, ' ');
  }

  private initCheerio(html: string): CheerioAPI {
    return cheerio.load(html, {
      decodeEntities: true,
      normalizeWhitespace: true,
      xmlMode: false
    });
  }

  private getBaseUrl(url: string): string {
    const $ = this.$;
    const baseHref = $('base[href]').attr('href');
    
    if (baseHref && baseHref.startsWith('http')) {
      return baseHref;
    }
    
    return url;
  }

  private handleSpecialSites(url: string): void {
    const $ = this.$;
    
    // CSDN 博客特殊处理
    if (url.includes('blog.csdn.net')) {
      $('#content_views .pre-numbering').remove();
    }
    
    // 简书特殊处理
    if (url.includes('jianshu.com')) {
      $('.collapse-tips').remove();
    }
    
    // 知乎特殊处理
    if (url.includes('zhihu.com')) {
      $('.ContentItem-actions').remove();
      $('.Reward').remove();
    }
    
    // 微信文章特殊处理
    if (url.includes('mp.weixin.qq.com')) {
      $('#js_pc_qr_code').remove();
      $('.qr_code_pc_outer').remove();
    }
  }

  protected postProcess(element: AnyNode): void {
    super.postProcess(element);
    
    const $ = this.$;
    const $elem = $(element);
    
    // 移除文章底部的推荐阅读
    $elem.find('.related-posts, .recommended-posts').remove();
    
    // 移除分享按钮
    $elem.find('.share-buttons, .social-share').remove();
    
    // 移除文章底部的订阅提示
    $elem.find('.subscribe-form, .newsletter-signup').remove();
    
    // 规范化标题层级
    this.normalizeHeadings($elem);
    
    // 规范化列表
    this.normalizeLists($elem);
    
    // 规范化表格
    this.normalizeTables($elem);
  }

  private normalizeHeadings($elem: Cheerio<AnyNode>): void {
    const headings = $elem.find('h1, h2, h3, h4, h5, h6').toArray();
    let lastLevel = 1;
    
    headings.forEach(heading => {
      const currentLevel = parseInt(heading.tagName.slice(1));
      if (currentLevel - lastLevel > 1) {
        // 调整标题层级
        const newLevel = lastLevel + 1;
        const $heading = this.$(heading);
        $heading.replaceWith(`<h${newLevel}>${$heading.html()}</h${newLevel}>`);
      }
      lastLevel = currentLevel;
    });
  }

  private normalizeLists($elem: Cheerio<AnyNode>): void {
    // 确保列表项都在列表容器中
    $elem.find('li').each((_: number, li: AnyNode) => {
      const $li = this.$(li);
      if (!$li.parent().is('ul, ol')) {
        $li.wrap('<ul>');
      }
    });
  }

  private normalizeTables($elem: Cheerio<AnyNode>): void {
    // 确保表格都有thead和tbody
    $elem.find('table').each((_: number, table: AnyNode) => {
      const $table = this.$(table);
      
      // 添加thead
      if (!$table.find('thead').length && $table.find('tr').length) {
        const $firstRow = $table.find('tr').first();
        $firstRow.find('td').each((_: number, cell: AnyNode) => {
          const $cell = this.$(cell);
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
} 