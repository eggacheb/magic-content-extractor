import { BaseExtractor } from '../BaseExtractor';
import { type CheerioAPI, type CheerioNode, type CheerioElement, type Cheerio, type AnyNode, asElement } from '../../types/cheerio';
import { calculateTextLength, cleanHtml } from '../../utils/extractor';

export class ForumExtractor extends BaseExtractor {
  private uniqueIdAttr = 'data-unique-id';
  private uniqueIdCounter = 0;

  constructor() {
    super({
      minTextLength: 50,  // 论坛回复可能较短
      minScore: 15,      // 论坛内容评分要求较低
      includeComments: true  // 需要包含回复
    });
  }

  /**
   * 论坛特有的选择器
   */
  protected getCustomSelectors(): string[] {
    return [
      // 帖子内容选择器
      '.thread-content',
      '.post-content',
      '.topic-content',
      '.forum-post',
      '.forum-content',
      '.message-content',
      '.bbcode-content',
      // 主贴选择器
      '.first-post',
      '.main-post',
      '.original-post',
      '.thread-first',
      // 回复内容选择器
      '.reply-content',
      '.comment-content',
      '.response-content',
      // 通用选择器
      '#thread-content',
      '#post-content',
      '[itemprop="articleBody"]'
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
      removeComments: false  // 保留评论
    });

    // 移除干扰元素
    $('script, style, link, iframe, form').remove();
    $('.ad, .advertisement, .banner').remove();
    $('.user-signature, .signature').remove();
    $('.user-info, .author-info').remove();
    $('.post-actions, .thread-actions').remove();
    $('.share-buttons, .social-share').remove();
    
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
      // 移除表情图片
      if ($img.hasClass('emoji') || $img.hasClass('smilie') || 
          $img.attr('src')?.includes('emoji') || $img.attr('src')?.includes('smilie')) {
        $img.remove();
      }
    });

    // 生成唯一ID
    this.generateUniqueIds($);
  }

  /**
   * 为每个内容节点生成唯一ID
   */
  private generateUniqueIds($: CheerioAPI): void {
    $('.post, .thread, .reply, .comment').each((_, elem) => {
      const $elem = $(elem);
      if (!$elem.attr(this.uniqueIdAttr)) {
        $elem.attr(this.uniqueIdAttr, (++this.uniqueIdCounter).toString());
      }
    });
  }

  /**
   * 提取发帖时间
   */
  protected extractPublishTime(): string {
    const timeSelectors = [
      'meta[property="article:published_time"]',
      '.post-time',
      '.thread-time',
      '.publish-time',
      '.create-time',
      'time[pubdate]',
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
   * 提取回复数
   */
  protected extractReplyCount(): number {
    const replySelectors = [
      '.reply-count',
      '.comment-count',
      '.response-count',
      '.post-replies'
    ];

    for (const selector of replySelectors) {
      const $count = this.$(selector);
      if ($count.length > 0) {
        const text = $count.first().text().trim();
        const count = parseInt(text.replace(/[^0-9]/g, ''));
        if (!isNaN(count)) {
          return count;
        }
      }
    }

    // 计算回复元素数量
    const replyElements = this.$('.reply-content, .comment-content, .response-content').length;
    return replyElements;
  }

  /**
   * 提取浏览数
   */
  protected extractViewCount(): number {
    const viewSelectors = [
      '.view-count',
      '.views',
      '.hits',
      '.read-count'
    ];

    for (const selector of viewSelectors) {
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

    // 获取base_url
    const $ = this.$;
    const baseHref = $('base[href]').attr('href');
    const baseUrl = (baseHref && baseHref.startsWith('http')) ? baseHref : url;

    // 提取内容
    const result = await super.extract(html, baseUrl);

    // 处理主贴和回复
    const mainPostId = this.findMainPostId(result.content);
    
    if (mainPostId) {
      // 重新组织内容顺序
      result.content = this.reorganizeContent(result.content, mainPostId);
    }
    
    // 添加论坛特有的元数据
    result.metadata = {
      ...result.metadata,
      publishTime: this.extractPublishTime(),
      replyCount: this.extractReplyCount(),
      viewCount: this.extractViewCount(),
      platform: 'forum'
    };

    return result;
  }

  /**
   * 查找主贴ID
   */
  private findMainPostId(content: string): string {
    const $ = this.$;
    const $content = $(content);

    // 尝试从class查找
    const $mainPost = $content.find('.first-post, .main-post, .original-post').first();
    if ($mainPost.length) {
      return $mainPost.attr(this.uniqueIdAttr) || '';
    }

    // 尝试从ID查找
    const $postWithId = $content.find('[id*="post-1"], [id*="post_1"]').first();
    if ($postWithId.length) {
      return $postWithId.attr(this.uniqueIdAttr) || '';
    }

    // 使用第一个帖子作为主贴
    const $firstPost = $content.find('.post, .thread').first();
    return $firstPost.attr(this.uniqueIdAttr) || '';
  }

  /**
   * 重新组织内容顺序
   */
  private reorganizeContent(content: string, mainPostId: string): string {
    const $ = this.$;
    const $content = $(content);
    const $mainPost = $content.find(`[${this.uniqueIdAttr}="${mainPostId}"]`);
    
    if (!$mainPost.length) return content;

    // 创建新的容器
    const $container = $('<div class="forum-thread"></div>');
    
    // 添加主贴
    $container.append($mainPost.clone());
    
    // 添加回复
    const $replies = $content.find(`[${this.uniqueIdAttr}]`).filter(function(this: CheerioElement) {
      const id = $(this).attr('data-unique-id');
      return id !== undefined && id !== mainPostId;
    });

    if ($replies.length) {
      const $repliesContainer = $('<div class="forum-replies"></div>');
      $replies.each((_, reply) => {
        $repliesContainer.append($(reply).clone());
      });
      $container.append($repliesContainer);
    }

    return $container.html() || content;
  }

  /**
   * 重写节点评分方法
   */
  protected calculateNodeScore(node: CheerioNode): number {
    let score = super.calculateNodeScore(node);
    
    const $node = this.$(asElement(node));
    
    // 主贴内容加分
    if ($node.hasClass('first-post') || $node.hasClass('main-post')) {
      score += 15;
    }
    
    // 回复内容加分(但分值低于主贴)
    if ($node.hasClass('reply-content') || $node.hasClass('comment-content')) {
      score += 8;
    }
    
    // 包含引用内容的减分(避免重复内容)
    if ($node.find('.quote, blockquote, .cited').length > 0) {
      score -= 5;
    }
    
    // 包含用户信息的减分
    if ($node.find('.user-info, .author-info').length > 0) {
      score -= 3;
    }
    
    // 内容长度评分
    const textLength = calculateTextLength(this.$, node);
    if (textLength > 100) {
      score += Math.min(Math.floor(textLength / 200), 8);
    }
    
    return score;
  }

  /**
   * 重写后处理方法
   */
  protected postProcess(element: CheerioNode): void {
    super.postProcess(element);
    
    const $elem = this.$(asElement(element));

    // 处理引用内容
    $elem.find('.quote, blockquote, .cited').each((_, quote) => {
      const $quote = this.$(quote);
      $quote.addClass('forum-quote');
    });

    // 处理代码块
    $elem.find('pre, code').each((_, block) => {
      const $block = this.$(block);
      const html = $block.html();
      if (html) {
        $block.html(html.replace(/\n/g, '<br>'));
      }
      $block.addClass('forum-code');
    });

    // 处理图片
    $elem.find('img').each((_, img) => {
      const $img = this.$(img);
      // 添加图片容器
      $img.wrap('<div class="forum-image-container"></div>');
      // 处理图片说明
      const alt = $img.attr('alt');
      if (alt) {
        $img.after(`<div class="forum-image-caption">${alt}</div>`);
      }
    });

    // 移除多余的空行
    $elem.html(($elem.html() || '').replace(/(\s*<br\s*\/?>\s*){3,}/g, '<br><br>'));
  }
} 