import type { CheerioAPI } from 'cheerio';
import type { Element } from 'domhandler';
import { calculateSimilarity } from '../../utils/similarity';

// 元数据选择器
const META_SELECTORS = [
  'meta[property="og:title"]',
  'meta[name="twitter:title"]',
  'meta[property="title"]',
  'meta[name="title"]',
  'meta[itemprop="name"]',
  'meta[itemprop="headline"]',
] as const;

export class TitleExtractor {
  /**
   * 从页面提取标题
   */
  public extract($: CheerioAPI): string {
    // 1. 尝试从元数据中提取
    const metaTitle = this.extractFromMeta($);
    if (metaTitle) {
      return metaTitle;
    }

    // 2. 尝试从标题标签中提取
    const titleTagContent = this.extractFromTitleTag($);
    
    // 3. 尝试从标题元素中提取
    const headingTitles = this.extractFromHeadings($);
    
    // 4. 如果有标题标签内容和标题元素内容，选择最相似的
    if (titleTagContent && headingTitles.length > 0) {
      // 按照与标题标签内容的相似度排序
      headingTitles.sort((a, b) => 
        calculateSimilarity(b, titleTagContent) - calculateSimilarity(a, titleTagContent)
      );
      
      // 返回最相似的标题
      const mostSimilarTitle = headingTitles[0];
      return this.getLongestCommonSubstring(mostSimilarTitle, titleTagContent);
    }
    
    // 5. 如果只有标题标签内容，返回它
    if (titleTagContent) {
      return titleTagContent;
    }
    
    // 6. 如果只有标题元素内容，返回第一个
    if (headingTitles.length > 0) {
      return headingTitles[0];
    }
    
    // 7. 如果都没有，返回空字符串
    return '';
  }
  
  /**
   * 从元数据中提取标题
   */
  private extractFromMeta($: CheerioAPI): string {
    for (const selector of META_SELECTORS) {
      const metaElement = $(selector);
      if (metaElement.length) {
        const content = metaElement.attr('content');
        if (content) {
          return this.cleanTitle(content);
        }
      }
    }
    return '';
  }
  
  /**
   * 从标题标签中提取标题
   */
  private extractFromTitleTag($: CheerioAPI): string {
    const titleText = $('title').text();
    return this.cleanTitle(titleText);
  }
  
  /**
   * 从标题元素中提取标题
   */
  private extractFromHeadings($: CheerioAPI): string[] {
    const titles: string[] = [];
    
    // 按优先级查找标题元素
    ['h1', 'h2', 'h3'].forEach(tag => {
      $(tag).each((_: number, element: Node) => {
        const text = $(element).text();
        const cleanedText = this.cleanTitle(text);
        if (cleanedText && !titles.includes(cleanedText)) {
          titles.push(cleanedText);
        }
      });
    });
    
    return titles;
  }
  
  /**
   * 清理标题文本
   */
  private cleanTitle(title: string): string {
    return title
      .replace(/[\n\r\t]/g, ' ') // 替换换行和制表符
      .replace(/\s+/g, ' ')      // 合并空白字符
      .replace(/^\s+|\s+$/g, '') // 去除首尾空白
      .replace(/\s*[-_|]\s*.*$/, '') // 移除分隔符后的网站名称
      .replace(/^.*?\|\s*/, '')  // 移除网站名称和分隔符
      .trim();
  }
  
  /**
   * 获取两个字符串的最长公共子串
   */
  private getLongestCommonSubstring(str1: string, str2: string): string {
    if (!str1 || !str2) {
      return str1 || str2;
    }
    
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
    let maxLength = 0;
    let endIndex = 0;
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
          if (dp[i][j] > maxLength) {
            maxLength = dp[i][j];
            endIndex = i;
          }
        }
      }
    }
    
    return str1.slice(endIndex - maxLength, endIndex);
  }
} 