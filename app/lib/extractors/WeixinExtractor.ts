import { BaseExtractor } from '../BaseExtractor';
import { type CheerioAPI, type CheerioNode, type CheerioElement, asElement } from '../../types/cheerio';
import { calculateTextLength, cleanHtml } from '../../utils/extractor';

export class WeixinExtractor extends BaseExtractor {
  constructor() {
    super({
      minTextLength: 100,  // 微信文章通常较长
      minScore: 20,       // 评分要求适中
      includeComments: false  // 不包含评论
    });
  }

  /**
   * 检查是否可以处理该URL
   */
  public canHandle(url: string): boolean {
    return url.includes('mp.weixin.qq.com');
  }

  /**
   * 微信文章特有的选择器
   */
  protected getCustomSelectors(): string[] {
    return [
      '#js_content',
      '.rich_media_content',
      '.rich_media_area_primary',
      '.rich_media_area_primary_inner',
      '#content_html',
      '.article-content'
    ];
  }

  /**
   * 预处理
   */
  protected preProcess($: CheerioAPI): void {
    // 清理HTML
    cleanHtml($, {
      removeScripts: true,
      removeStyles: true,
      removeComments: true
    });

    // 移除干扰元素
    this.removeNoiseElements($);
    
    // 处理图片
    this.processImages($);

    // 处理视频
    this.processVideos($);

    // 处理样式
    this.processStyles($);

    // 调试日志
    console.log('Available content elements:');
    this.getCustomSelectors().forEach(selector => {
      const elements = $(selector);
      console.log(`${selector}: ${elements.length} elements found`);
      if (elements.length > 0) {
        console.log(`Content preview for ${selector}:`, elements.first().text().slice(0, 100));
      }
    });
  }

  /**
   * 移除干扰元素
   */
  private removeNoiseElements($: CheerioAPI): void {
    // 移除公众号信息
    $('#meta_content').remove();
    $('#js_tags').remove();
    $('.original_area_primary').remove();
    $('.wx_profile_card_inner').remove();
    $('section.wx_profile_msg_inner').remove();
    
    // 移除底部元素
    $('#js_pc_qr_code').remove();
    $('.qr_code_pc_outer').remove();
    $('.rich_media_tool').remove();
    $('.rich_media_area_extra').remove();
    
    // 移除广告
    $('.advertisement_area').remove();
    $('.reward_area').remove();
    $('.reward_qrcode_area').remove();
    
    // 移除隐藏内容
    $('[style*="display: none"]').remove();
    $('[style*="visibility: hidden"]').remove();
  }

  /**
   * 处理图片
   */
  private processImages($: CheerioAPI): void {
    $('img').each((_, img) => {
      const $img = $(img);
      
      // 处理data-src
      const dataSrc = $img.attr('data-src');
      if (dataSrc) {
        $img.attr('src', dataSrc);
        $img.removeAttr('data-src');
      }
      
      // 移除懒加载属性
      $img.removeAttr('data-lazy-src');
      $img.removeAttr('data-fail');
      
      // 处理样式
      $img.css({
        'max-width': '100%',
        'height': 'auto',
        'display': 'block',
        'margin': '10px auto'
      });
      
      // 添加图片说明
      const imgDesc = $img.attr('alt') || $img.attr('data-backh');
      if (imgDesc) {
        $img.after(`<div class="weixin-img-desc">${imgDesc}</div>`);
      }
    });
  }

  /**
   * 处理视频
   */
  private processVideos($: CheerioAPI): void {
    // 处理腾讯视频
    $('.video_iframe').each((_, video) => {
      const $video = $(video);
      const vid = $video.attr('data-vidtype') || '';
      if (vid) {
        $video.replaceWith(`
          <div class="weixin-video-container">
            <iframe 
              src="https://v.qq.com/txp/iframe/player.html?vid=${vid}"
              frameborder="0"
              allowfullscreen
            ></iframe>
          </div>
        `);
      }
    });
  }

  /**
   * 处理样式
   */
  private processStyles($: CheerioAPI): void {
    // 移除空白文本颜色
    $('[style*="color: rgba(255, 255, 255, 0)"]').remove();
    $('[style*="color: rgb(255, 255, 255)"][style*="opacity: 0"]').remove();
    
    // 规范化标题样式
    $('h1, h2, h3, h4, h5, h6').each((_, heading) => {
      const $heading = $(heading);
      $heading.css({
        'margin': '20px 0',
        'font-weight': 'bold',
        'line-height': '1.4'
      });
    });
    
    // 规范化段落样式
    $('p').each((_, p) => {
      const $p = $(p);
      $p.css({
        'margin': '10px 0',
        'line-height': '1.6'
      });
    });
  }

  /**
   * 提取作者信息
   */
  protected extractAuthor(): string {
    const authorSelectors = [
      '#js_name',
      '.rich_media_meta_nickname',
      '.profile_nickname',
      'meta[property="og:article:author"]'
    ];

    for (const selector of authorSelectors) {
      const $author = this.$(selector);
      if ($author.length > 0) {
        if (selector.startsWith('meta')) {
          return $author.attr('content') || '';
        }
        return $author.first().text().trim();
      }
    }

    return '';
  }

  /**
   * 提取发布时间
   */
  protected extractPublishTime(): string {
    const timeSelectors = [
      '#publish_time',
      '#post-date',
      '.rich_media_meta_date',
      '.publish_time',
      'meta[property="og:article:published_time"]'
    ];

    for (const selector of timeSelectors) {
      const $time = this.$(selector);
      if ($time.length > 0) {
        if (selector.startsWith('meta')) {
          return $time.attr('content') || '';
        }
        return $time.first().text().trim();
      }
    }

    return '';
  }

  /**
   * 提取阅读数
   */
  protected extractReadCount(): number {
    const countSelectors = [
      '#js_read_count',
      '.read_count',
      '.weui-page__read-count'
    ];

    for (const selector of countSelectors) {
      const $count = this.$(selector);
      if ($count.length > 0) {
        const text = $count.first().text().trim();
        const count = parseInt(text.replace(/[^0-9]/g, ''));
        if (!isNaN(count)) {
          return count;
        }
      }
    }

    return 0;
  }

  /**
   * 重写提取方法
   */
  public async extract(html: string, url: string) {
    // 预处理HTML
    html = html
      .replace(/&nbsp;/g, ' ')
      .replace(/&#160;/g, ' ')
      .replace(/\s+/g, ' ');

    // 提取内容
    const result = await super.extract(html, url);

    // 添加微信文章特有的元数据
    result.metadata = {
      ...result.metadata,
      author: this.extractAuthor(),
      publishTime: this.extractPublishTime(),
      readCount: this.extractReadCount(),
      platform: 'weixin'
    };

    return result;
  }

  /**
   * 重写节点评分方法
   */
  protected calculateNodeScore(node: CheerioNode): number {
    let score = super.calculateNodeScore(node);
    
    const $node = this.$(asElement(node));
    
    // 微信文章主体加分
    if ($node.attr('id') === 'js_content' || $node.hasClass('rich_media_content')) {
      score += 20;
    }
    
    // 内容长度评分
    const textLength = calculateTextLength(this.$, node);
    if (textLength > 100) {
      score += Math.min(Math.floor(textLength / 100), 10);
    }
    
    // 图片评分
    const imageCount = $node.find('img').length;
    if (imageCount > 0) {
      score += Math.min(imageCount * 2, 10);
    }
    
    // 视频评分
    const videoCount = $node.find('iframe, .video_iframe').length;
    if (videoCount > 0) {
      score += videoCount * 5;
    }
    
    // 广告和干扰内容减分
    if ($node.find('.advertisement_area, .reward_area').length > 0) {
      score -= 15;
    }
    
    return score;
  }

  /**
   * 重写后处理方法
   */
  protected postProcess(element: CheerioNode): void {
    super.postProcess(element);
    
    const $elem = this.$(asElement(element));

    // 处理代码块
    $elem.find('pre, code').each((_, block) => {
      const $block = this.$(block);
      const html = $block.html();
      if (html) {
        $block.html(html.replace(/\n/g, '<br>'));
      }
      $block.addClass('weixin-code');
    });

    // 处理引用块
    $elem.find('blockquote').each((_, quote) => {
      const $quote = this.$(quote);
      $quote.addClass('weixin-quote');
    });

    // 处理图片
    $elem.find('img').each((_, img) => {
      const $img = this.$(img);
      // 添加图片容器
      $img.wrap('<div class="weixin-img-container"></div>');
    });

    // 处理视频
    $elem.find('iframe').each((_, iframe) => {
      const $iframe = this.$(iframe);
      $iframe.wrap('<div class="weixin-video-container"></div>');
    });

    // 移除多余的空行
    $elem.html(($elem.html() || '').replace(/(\s*<br\s*\/?>\s*){3,}/g, '<br><br>'));
  }
} 