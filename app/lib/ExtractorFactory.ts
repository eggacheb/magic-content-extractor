import { BaseExtractor } from './BaseExtractor';
import { ArticleExtractor } from './extractors/ArticleExtractor';
import { WeixinExtractor } from './extractors/WeixinExtractor';
import { ForumExtractor } from './extractors/ForumExtractor';
import { ExtractorOptions } from '../types/extractor';

export class ExtractorFactory {
  private static extractors: BaseExtractor[] = [];
  private static defaultExtractor: BaseExtractor;

  /**
   * 初始化提取器工厂
   */
  public static init(options: ExtractorOptions = {}): void {
    // 创建提取器实例
    this.extractors = [
      new WeixinExtractor(),   // 微信文章优先级最高
      new ForumExtractor(),    // 论坛内容次之
      new ArticleExtractor(),  // 普通文章最后
    ];

    // 设置默认提取器
    this.defaultExtractor = new BaseExtractor(options);
  }

  /**
   * 获取适合的提取器
   */
  public static getExtractor(url: string): BaseExtractor {
    // 如果提取器列表为空，先初始化
    if (this.extractors.length === 0) {
      this.init();
    }

    // 查找能处理该URL的提取器
    const extractor = this.extractors.find(e => e.canHandle(url));
    
    // 如果没有找到合适的提取器，返回默认提取器
    return extractor || this.defaultExtractor;
  }

  /**
   * 提取内容
   */
  public static async extract(html: string, url: string) {
    const extractor = this.getExtractor(url);
    return await extractor.extract(html, url);
  }
} 