import { type CheerioAPI, type CheerioNode } from '@/types/cheerio';

export class TitleExtractor {
  private $!: CheerioAPI;
  
  public extract($: CheerioAPI): string {
    this.$ = $;
    
    // 尝试从 meta 标签获取标题
    const metaTitle = this.extractFromMeta();
    if (metaTitle) return metaTitle;
    
    // 尝试从 h1 标签获取标题
    const h1Title = this.extractFromH1();
    if (h1Title) return h1Title;
    
    // 尝试从其他标签获取标题
    const otherTitle = this.extractFromOtherTags();
    if (otherTitle) return otherTitle;
    
    // 如果都没有找到，返回空字符串
    return '';
  }
  
  private extractFromMeta(): string {
    const $ = this.$;
    
    // 尝试从不同的 meta 标签获取标题
    const metaTags = [
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'meta[name="title"]'
    ];
    
    for (const tag of metaTags) {
      const content = $(tag).attr('content')?.trim();
      if (content) return content;
    }
    
    return '';
  }
  
  private extractFromH1(): string {
    const $ = this.$;
    const h1 = $('h1').first();
    return h1.text().trim();
  }
  
  private extractFromOtherTags(): string {
    const $ = this.$;
    
    // 尝试从其他可能包含标题的标签获取
    const titleTags = [
      'title',
      '.article-title',
      '.post-title',
      '.entry-title',
      '#title'
    ];
    
    for (const tag of titleTags) {
      const element = $(tag).first();
      const text = element.text().trim();
      if (text) return text;
    }
    
    return '';
  }
} 