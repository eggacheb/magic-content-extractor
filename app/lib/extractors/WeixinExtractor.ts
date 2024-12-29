import * as cheerio from 'cheerio';
import type { CheerioAPI, AnyNode, Cheerio } from 'cheerio';
import { BaseExtractor } from '../BaseExtractor';
import { ExtractResult, WEIXIN_SELECTORS } from '../../types/extractor';

export class WeixinExtractor extends BaseExtractor {
  constructor() {
    super({
      minTextLength: 100,  // 微信文章通常较长
      minScore: 30,       // 评分要求更高
    });
  }

  public canHandle(url: string): boolean {
    return url.includes('mp.weixin.qq.com');
  }

  public async extract(html: string, url: string): Promise<ExtractResult> {
    // 预处理HTML
    html = this.preprocessHtml(html);
    
    // 初始化cheerio
    this.$ = cheerio.load(html, {
      decodeEntities: true,
      normalizeWhitespace: true,
      xmlMode: false
    });
    
    // 获取文章区域
    const contentArea = this.$(WEIXIN_SELECTORS.content);
    if (!contentArea.length) {
      throw new Error('无法找到微信文章内容区域');
    }
    
    // 清理文档
    this.cleanDocument();
    
    // 提取标题
    const title = this.extractTitle();
    
    // 提取作者信息
    const author = this.extractAuthor();
    
    // 提取发布时间
    const publishTime = this.extractPublishTime();
    
    // 提取阅读数和点赞数
    const { readCount, likeCount } = this.extractStats();
    
    // 提取主要内容
    const mainContent = contentArea[0];
    
    // 预处理内容
    this.preprocessContent(mainContent);
    
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
      url,
      metadata: {
        author,
        publishTime,
        readCount,
        likeCount,
        platform: 'weixin'
      }
    };
  }

  protected getCustomSelectors(): string[] {
    return [
      WEIXIN_SELECTORS.content,
      WEIXIN_SELECTORS.content_area,
    ];
  }

  private preprocessHtml(html: string): string {
    return html
      .replace(/&nbsp;/g, ' ')
      .replace(/&#160;/g, ' ')
      .replace(/\s+/g, ' ');
  }

  private preprocessContent(element: AnyNode): void {
    const $ = this.$;
    const $elem = $(element);
    
    // 移除公众号介绍
    $elem.find(WEIXIN_SELECTORS.profile).remove();
    $elem.find(WEIXIN_SELECTORS.tags).remove();
    $elem.find(WEIXIN_SELECTORS.profileCard).remove();
    $elem.find(WEIXIN_SELECTORS.profileMsg).remove();
    
    // 移除付费墙
    $elem.find(WEIXIN_SELECTORS.pay_wall).remove();
    
    // 处理图片
    $elem.find('img').each((_: number, img: AnyNode) => {
      const $img = $(img);
      const dataSrc = $img.attr('data-src');
      if (dataSrc) {
        $img.attr('src', dataSrc);
      }
    });
    
    // 处理标题
    $elem.find('h1').each((_: number, h1: AnyNode) => {
      const $h1 = $(h1);
      const text = $h1.text();
      if (text) {
        $h1.text(text.replace(/\n/g, '').trim());
      }
    });
    
    // 移除隐藏内容
    $elem.find('[style*="color: rgba(255, 255, 255, 0)"]').remove();
    $elem.find('[style*="color: rgba(255 255 255 0)"]').remove();
  }

  private extractAuthor(): string {
    return this.$(WEIXIN_SELECTORS.author).text().trim();
  }

  private extractPublishTime(): string {
    return this.$(WEIXIN_SELECTORS.publishTime).text().trim();
  }

  private extractStats(): { readCount: number; likeCount: number } {
    const readText = this.$(WEIXIN_SELECTORS.readNum).text().trim();
    const likeText = this.$(WEIXIN_SELECTORS.likeNum).text().trim();
    
    return {
      readCount: this.parseNumber(readText),
      likeCount: this.parseNumber(likeText)
    };
  }

  private parseNumber(text: string): number {
    const num = parseInt(text.replace(/[^0-9]/g, ''));
    return isNaN(num) ? 0 : num;
  }

  protected postProcess(element: AnyNode): void {
    super.postProcess(element);
    
    const $ = this.$;
    const $elem = $(element);
    
    // 移除文章底部的推荐阅读
    $elem.find('.relate_article_list').remove();
    
    // 移除赞赏按钮
    $elem.find('.reward_area').remove();
    
    // 移除音频播放器
    $elem.find('.audio_card').remove();
    
    // 移除视频号推广
    $elem.find('.weapp_text_link').remove();
    
    // 移除广告
    $elem.find('.advertisement_area').remove();
    
    // 规范化图片
    $elem.find('img').each((_: number, img: AnyNode) => {
      const $img = $(img);
      // 保留原始尺寸
      const width = $img.attr('data-w');
      const height = $img.attr('data-h');
      if (width) $img.attr('width', width);
      if (height) $img.attr('height', height);
      // 添加加载属性
      $img.attr('loading', 'lazy');
      // 添加替代文本
      if (!$img.attr('alt')) {
        $img.attr('alt', '文章配图');
      }
    });
    
    // 规范化链接
    $elem.find('a').each((_: number, link: AnyNode) => {
      const $link = $(link);
      // 处理外链
      const href = $link.attr('href');
      if (href?.startsWith('http')) {
        $link.attr('target', '_blank');
        $link.attr('rel', 'noopener noreferrer');
      }
    });
  }
} 