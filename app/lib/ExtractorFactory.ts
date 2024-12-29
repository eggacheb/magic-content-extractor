import { ArticleExtractor } from './extractors/ArticleExtractor';
import { ForumExtractor } from './extractors/ForumExtractor';
import { TitleExtractor } from './extractors/TitleExtractor';
import { WeixinExtractor } from './extractors/WeixinExtractor';
import { BaseExtractor } from './BaseExtractor';
import { WebsiteType } from '../types/extractor';

export class ExtractorFactory {
  private static extractors: Map<string, BaseExtractor> = new Map();

  /**
   * 获取提取器实例
   * @param type 网站类型
   * @returns 对应的提取器实例
   */
  public static getExtractor(type: WebsiteType): BaseExtractor {
    // 检查缓存
    if (this.extractors.has(type)) {
      return this.extractors.get(type)!;
    }

    // 创建新实例
    let extractor: BaseExtractor;
    switch (type) {
      case 'article':
        extractor = new ArticleExtractor();
        break;
      case 'forum':
        extractor = new ForumExtractor();
        break;
      case 'weixin':
        extractor = new WeixinExtractor();
        break;
      default:
        throw new Error(`Unsupported extractor type: ${type}`);
    }

    // 缓存实例
    this.extractors.set(type, extractor);
    return extractor;
  }

  /**
   * 根据URL自动判断并获取合适的提取器
   * @param url 网页URL
   * @returns 合适的提取器实例
   */
  public static getExtractorByUrl(url: string): BaseExtractor {
    // 微信文章
    if (url.includes('mp.weixin.qq.com')) {
      return this.getExtractor('weixin');
    }
    
    // 论坛特征
    if (url.includes('forum') || url.includes('bbs') || url.includes('thread')) {
      return this.getExtractor('forum');
    }

    // 默认使用文章提取器
    return this.getExtractor('article');
  }

  /**
   * 获取标题提取器
   * @returns 标题提取器实例
   */
  public static getTitleExtractor(): TitleExtractor {
    return new TitleExtractor();
  }

  /**
   * 清除提取器缓存
   */
  public static clearCache(): void {
    this.extractors.clear();
  }
} 