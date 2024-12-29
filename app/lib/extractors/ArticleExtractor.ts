import { BaseExtractor } from '../BaseExtractor';
import { type CheerioAPI, type CheerioNode, type CheerioElement, asElement } from '../../types/cheerio';
import { calculateTextLength, cleanHtml } from '../../utils/extractor';

export class ArticleExtractor extends BaseExtractor {
  constructor() {
    super({
      minTextLength: 150, // 文章内容通常较长
      minScore: 25      // 文章评分要求更高
    });
  }

  /**
   * 文章特有的选择器
   */
  protected getCustomSelectors(): string[] {
    return [
      // 文章主体选择器
      'article',
      '.article',
      '.post-content',
      '.entry-content',
      '.article-content',
      '.article-body',
      '.post-body',
      '.content-main',
      // 博客平台选择器
      '.blog-post',
      '.blog-entry',
      '.blog-content',
      // 内容区选择器
      '#article-content',
      '#post-content',
      '#content-main',
      // 语义化选择器
      '[itemprop="articleBody"]',
      '[property="og:description"]',
      // 富文本内容
      '.rich_media_content',
      '.rich-content'
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
    $('header, footer, nav, aside').remove();
    $('.comment-list, .related-posts, .share-buttons').remove();
    $('.advertisement, .ad, .banner').remove();
    $('.author-info, .article-meta').remove();
    
    // 处理图片
    $('img').each((_, img) => {
      const $img = $(img);
      // 处理懒加载
      if ($img.attr('data-src')) {
        $img.attr('src', $img.attr('data-src'));
      }
      if ($img.attr('data-original')) {
        $img.attr('src', $img.attr('data-original'));
      }
      // 添加图片说明
      const alt = $img.attr('alt');
      if (alt) {
        $img.after(`<figcaption class="image-caption">${alt}</figcaption>`);
      }
    });

    // 处理视频
    $('video').each((_, video) => {
      const $video = $(video);
      if ($video.attr('data-src')) {
        $video.attr('src', $video.attr('data-src'));
      }
    });

    // 处理链接
    $('a').each((_, link) => {
      const $link = $(link);
      // 移除广告链接
      if ($link.attr('href')?.includes('javascript:') || 
          $link.attr('href')?.includes('ads') ||
          $link.attr('href') === '#') {
        $link.removeAttr('href');
      }
    });
  }

  /**
   * 提取作者信息
   */
  protected extractAuthor(): string {
    const authorSelectors = [
      'meta[name="author"]',
      'meta[property="article:author"]',
      '.author-name',
      '.author',
      '.byline',
      '.writer',
      '[rel="author"]'
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
      'meta[property="article:published_time"]',
      'meta[name="publishdate"]',
      'time[pubdate]',
      '.publish-time',
      '.post-time',
      '.entry-date',
      '.post-date',
      '[datetime]'
    ];

    for (const selector of timeSelectors) {
      const $time = this.$(selector);
      if ($time.length > 0) {
        if (selector.startsWith('meta')) {
          return $time.attr('content') || '';
        }
        if ($time.attr('datetime')) {
          return $time.attr('datetime') || '';
        }
        return $time.first().text().trim();
      }
    }

    return '';
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

    // 获取base_url
    const $ = this.$;
    const baseHref = $('base[href]').attr('href');
    const baseUrl = (baseHref && baseHref.startsWith('http')) ? baseHref : url;

    // 特殊站点处理
    this.handleSpecialSites(url);

    // 提取内容
    const result = await super.extract(html, baseUrl);

    // 添加文章特有的元数据
    result.metadata = {
      ...result.metadata,
      author: this.extractAuthor(),
      publishTime: this.extractPublishTime(),
      platform: 'article'
    };

    return result;
  }

  /**
   * 处理特殊站点
   */
  private handleSpecialSites(url: string): void {
    const $ = this.$;
    
    // CSDN博客
    if (url.includes('blog.csdn.net')) {
      $('#content_views .pre-numbering').remove();
      $('.article-copyright').remove();
    }
    
    // 简书
    if (url.includes('jianshu.com')) {
      $('.collapse-tips').remove();
      $('.support-author').remove();
    }
    
    // 知乎
    if (url.includes('zhihu.com')) {
      $('.ContentItem-actions').remove();
      $('.Reward').remove();
    }
    
    // 微信文章
    if (url.includes('mp.weixin.qq.com')) {
      $('#js_pc_qr_code').remove();
      $('.qr_code_pc_outer').remove();
    }
  }

  /**
   * 重写节点评分方法
   */
  protected calculateNodeScore(node: CheerioNode): number {
    let score = super.calculateNodeScore(node);
    
    const $node = this.$(asElement(node));
    
    // 文章主体加分
    if ($node.is('article') || $node.hasClass('article')) {
      score += 15;
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
    
    // 标题评分
    const headingCount = $node.find('h1, h2, h3, h4, h5, h6').length;
    if (headingCount > 0) {
      score += headingCount * 4;
    }
    
    // 段落评分
    const paragraphCount = $node.find('p').length;
    if (paragraphCount > 0) {
      score += Math.min(paragraphCount, 5);
    }
    
    // 广告和干扰内容减分
    if ($node.find('.ad, .advertisement, .banner').length > 0) {
      score -= 10;
    }
    
    // 评论区减分
    if ($node.find('.comment, .comments, #comments').length > 0) {
      score -= 8;
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
      $block.addClass('article-code');
    });

    // 处理引用块
    $elem.find('blockquote').each((_, quote) => {
      const $quote = this.$(quote);
      $quote.addClass('article-quote');
    });

    // 处理图片
    $elem.find('img').each((_, img) => {
      const $img = this.$(img);
      // 添加图片容器
      $img.wrap('<div class="article-image-container"></div>');
      // 处理图片说明
      const alt = $img.attr('alt');
      if (alt) {
        $img.after(`<div class="article-image-caption">${alt}</div>`);
      }
    });

    // 处理标题层级
    let lastLevel = 1;
    $elem.find('h1, h2, h3, h4, h5, h6').each((_, heading) => {
      const $heading = this.$(heading);
      const level = parseInt(heading.tagName[1]);
      
      // 确保标题层级连续
      if (level - lastLevel > 1) {
        const newLevel = Math.min(lastLevel + 1, 6);
        $heading.replaceWith(`<h${newLevel}>${$heading.html()}</h${newLevel}>`);
        lastLevel = newLevel;
      } else {
        lastLevel = level;
      }
    });

    // 规范化段落
    $elem.find('p').each((_, p) => {
      const $p = this.$(p);
      const text = $p.text().trim();
      // 移除空段落
      if (!text && !$p.find('img, video, iframe').length) {
        $p.remove();
      }
    });

    // 移除多余的空行
    $elem.html(($elem.html() || '').replace(/(\s*<br\s*\/?>\s*){3,}/g, '<br><br>'));
  }
} 