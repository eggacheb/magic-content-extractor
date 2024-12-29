import { type CheerioAPI, type CheerioNode } from '../../types/cheerio';
import { calculateSimilarity } from '../../utils/similarity';

export class TitleExtractor {
  private $!: CheerioAPI;
  
  /**
   * 提取页面标题
   */
  public extract($: CheerioAPI): string {
    this.$ = $;
    
    // 1. 尝试从meta标签获取标题
    const metaTitle = this.extractFromMeta();
    if (metaTitle) return this.cleanTitle(metaTitle);
    
    // 2. 尝试从h1-h3标签获取标题
    const hTitle = this.extractFromHeadings();
    if (hTitle) return this.cleanTitle(hTitle);
    
    // 3. 尝试从title标签获取标题
    const pageTitle = this.extractFromTitle();
    if (pageTitle) return this.cleanTitle(pageTitle);
    
    // 4. 尝试从其他标签获取标题
    const otherTitle = this.extractFromOtherTags();
    if (otherTitle) return this.cleanTitle(otherTitle);
    
    return '';
  }
  
  /**
   * 从meta标签提取标题
   */
  private extractFromMeta(): string {
    const metaSelectors = [
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'meta[name="title"]',
      'meta[property="article:title"]',
      'meta[name="application-name"]',
      'meta[property="og:site_name"]'
    ];
    
    for (const selector of metaSelectors) {
      const content = this.$(selector).attr('content')?.trim();
      if (content) return content;
    }
    
    return '';
  }
  
  /**
   * 从标题标签提取标题
   */
  private extractFromTitle(): string {
    return this.$('title').first().text().trim();
  }
  
  /**
   * 从h1-h3标签提取标题
   */
  private extractFromHeadings(): string {
    const $ = this.$;
    const pageTitle = this.extractFromTitle();
    
    // 获取所有h1-h3标签的文本
    const headings: string[] = [];
    $('h1, h2, h3').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text) headings.push(text);
    });
    
    if (headings.length === 0) return '';
    
    // 如果有页面标题,选择与页面标题最相似的heading
    if (pageTitle) {
      headings.sort((a, b) => {
        const similarityA = calculateSimilarity(a, pageTitle);
        const similarityB = calculateSimilarity(b, pageTitle);
        return similarityB - similarityA;
      });
      return headings[0];
    }
    
    // 否则返回第一个h1标签内容
    const h1Text = $('h1').first().text().trim();
    if (h1Text) return h1Text;
    
    // 如果没有h1,返回第一个找到的heading
    return headings[0];
  }
  
  /**
   * 从其他标签提取标题
   */
  private extractFromOtherTags(): string {
    const titleSelectors = [
      '.article-title',
      '.post-title',
      '.entry-title',
      '.title',
      '#title',
      '.article-header h1',
      '.post-header h1',
      '.entry-header h1',
      '[itemprop="headline"]',
      '[itemprop="name"]'
    ];
    
    for (const selector of titleSelectors) {
      const text = this.$(selector).first().text().trim();
      if (text) return text;
    }
    
    return '';
  }
  
  /**
   * 清理标题文本
   */
  private cleanTitle(title: string): string {
    return title
      // 移除多余空白字符
      .replace(/\s+/g, ' ')
      // 移除常见分隔符及其前后内容
      .replace(/\s*[|\-–_]\s*.+$/, '')
      // 移除括号及其内容
      .replace(/\s*[([{].*?[)\]}]\s*/g, ' ')
      // 移除HTML标签
      .replace(/<[^>]+>/g, '')
      // 移除特殊字符
      .replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, '')
      // 移除首尾空白
      .trim();
  }
} 