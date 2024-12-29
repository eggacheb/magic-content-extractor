import * as cheerio from 'cheerio';
import type { CheerioAPI, AnyNode, Cheerio } from 'cheerio';
import { BaseExtractor } from '../BaseExtractor';
import { ExtractResult, FORUM_SELECTORS } from '../../types/extractor';

interface ForumPost {
  content: string;
  author: string;
  publishTime: string;
  floor?: number;
  likes?: number;
  isOp?: boolean;
}

export class ForumExtractor extends BaseExtractor {
  constructor() {
    super({
      minTextLength: 50,    // 论坛帖子可能较短
      minScore: 20,        // 评分要求适中
      includeComments: true // 包含回复
    });
  }

  public canHandle(url: string): boolean {
    // 常见论坛URL特征
    const forumPatterns = [
      /\/(forum|bbs|thread|topic|discussion|viewthread|showthread)/,
      /\.(php|html)\?(?:.*)(tid|pid|fid|tid|id)=/,
      /\/t\/|\/p\//,
    ];

    return forumPatterns.some(pattern => pattern.test(url));
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
    
    // 清理文档
    this.cleanDocument();
    
    // 提取标题
    const title = this.extractTitle();
    
    // 提取主帖
    const mainPost = this.extractMainPost();
    
    // 提取回复
    const replies = this.extractReplies();
    
    // 获取统计信息
    const stats = this.extractStats();
    
    // 合并内容
    const content = this.mergeContent(mainPost, replies);
    
    // 后处理
    this.postProcess(content);
    
    // 获取内容
    const $content = this.$(content);
    const textContent = $content.text().trim();
    const htmlContent = $content.html() || '';

    return {
      title,
      content: htmlContent,
      textContent,
      html: htmlContent,
      url,
      metadata: {
        author: mainPost.author,
        publishTime: mainPost.publishTime,
        replyCount: replies.length,
        viewCount: stats.views,
        likeCount: stats.likes,
        platform: 'forum',
        isLocked: stats.isLocked,
        isSticky: stats.isSticky,
        isSolved: stats.isSolved
      }
    };
  }

  protected getCustomSelectors(): string[] {
    return [
      FORUM_SELECTORS.post,
      FORUM_SELECTORS.firstPost,
    ];
  }

  private preprocessHtml(html: string): string {
    return html
      .replace(/&nbsp;/g, ' ')
      .replace(/&#160;/g, ' ')
      .replace(/\s+/g, ' ');
  }

  private extractMainPost(): ForumPost {
    const $ = this.$;
    
    // 尝试找到主帖
    const firstPost = $(FORUM_SELECTORS.firstPost).first();
    const mainPost = firstPost.length ? firstPost : $(FORUM_SELECTORS.post).first();
    
    if (!mainPost.length) {
      throw new Error('无法找到主帖内容');
    }
    
    // 提取作者信息
    const author = this.extractAuthor(mainPost);
    
    // 提取发布时间
    const publishTime = this.extractPublishTime(mainPost);
    
    // 提取点赞数
    const likes = this.extractLikes(mainPost);
    
    return {
      content: mainPost.html() || '',
      author,
      publishTime,
      likes,
      floor: 1,
      isOp: true
    };
  }

  private extractReplies(): ForumPost[] {
    const $ = this.$;
    const replies: ForumPost[] = [];
    
    // 查找回复区域
    const replyArea = $(FORUM_SELECTORS.replies);
    if (!replyArea.length) {
      return replies;
    }
    
    // 提取每个回复
    replyArea.find(FORUM_SELECTORS.post).each((_: number, reply: AnyNode) => {
      const $reply = $(reply);
      
      // 跳过主帖
      if ($reply.closest(FORUM_SELECTORS.firstPost).length) {
        return;
      }
      
      replies.push({
        content: $reply.html() || '',
        author: this.extractAuthor($reply),
        publishTime: this.extractPublishTime($reply),
        likes: this.extractLikes($reply),
        floor: replies.length + 2,
        isOp: false
      });
    });
    
    return replies;
  }

  private extractAuthor($elem: Cheerio<AnyNode>): string {
    const $ = this.$;
    
    // 尝试不同的作者选择器
    const authorElement = $elem.find(FORUM_SELECTORS.authorName)
      .add($elem.find(FORUM_SELECTORS.author))
      .first();
    
    return authorElement.text().trim();
  }

  private extractPublishTime($elem: Cheerio<AnyNode>): string {
    const $ = this.$;
    
    // 尝试不同的时间选择器
    const timeElement = $elem.find(FORUM_SELECTORS.date)
      .add($elem.find(FORUM_SELECTORS.lastUpdate))
      .first();
    
    return timeElement.text().trim();
  }

  private extractLikes($elem: Cheerio<AnyNode>): number {
    const $ = this.$;
    const likesText = $elem.find(FORUM_SELECTORS.likes).text().trim();
    return this.parseNumber(likesText);
  }

  private extractStats(): {
    views: number;
    likes: number;
    isLocked: boolean;
    isSticky: boolean;
    isSolved: boolean;
  } {
    const $ = this.$;
    
    return {
      views: this.parseNumber($(FORUM_SELECTORS.views).text()),
      likes: this.parseNumber($(FORUM_SELECTORS.likes).text()),
      isLocked: $(FORUM_SELECTORS.locked).length > 0,
      isSticky: $(FORUM_SELECTORS.sticky).length > 0,
      isSolved: $(FORUM_SELECTORS.solved).length > 0
    };
  }

  private parseNumber(text: string): number {
    const num = parseInt(text.replace(/[^0-9]/g, ''));
    return isNaN(num) ? 0 : num;
  }

  private mergeContent(mainPost: ForumPost, replies: ForumPost[]): AnyNode {
    const $ = this.$;
    const container = $('<div class="forum-content"></div>');
    
    // 添加主帖
    container.append(this.formatPost(mainPost));
    
    // 添加回复
    if (replies.length > 0) {
      const repliesContainer = $('<div class="forum-replies"></div>');
      replies.forEach(reply => {
        repliesContainer.append(this.formatPost(reply));
      });
      container.append(repliesContainer);
    }
    
    return container[0];
  }

  private formatPost(post: ForumPost): string {
    const postClass = post.isOp ? 'forum-post main-post' : 'forum-post reply-post';
    return `
      <div class="${postClass}">
        <div class="post-meta">
          <span class="post-author">${post.author}</span>
          <span class="post-time">${post.publishTime}</span>
          ${post.floor ? `<span class="post-floor">#${post.floor}</span>` : ''}
          ${post.likes ? `<span class="post-likes">👍 ${post.likes}</span>` : ''}
        </div>
        <div class="post-content">
          ${post.content}
        </div>
      </div>
    `;
  }

  protected postProcess(element: AnyNode): void {
    super.postProcess(element);
    
    const $ = this.$;
    const $elem = $(element);
    
    // 处理引用内容
    $elem.find(FORUM_SELECTORS.quote).each((_: number, quote: AnyNode) => {
      const $quote = $(quote);
      $quote.addClass('post-quote');
    });
    
    // 处理附件
    $elem.find(FORUM_SELECTORS.attachment).each((_: number, attachment: AnyNode) => {
      const $attachment = $(attachment);
      $attachment.addClass('post-attachment');
    });
    
    // 处理投票
    $elem.find(FORUM_SELECTORS.poll).each((_: number, poll: AnyNode) => {
      const $poll = $(poll);
      $poll.addClass('post-poll');
    });
    
    // 处理评分
    $elem.find(FORUM_SELECTORS.rating).each((_: number, rating: AnyNode) => {
      const $rating = $(rating);
      $rating.addClass('post-rating');
    });
    
    // 规范化图片
    $elem.find('img').each((_: number, img: AnyNode) => {
      const $img = $(img);
      $img.attr('loading', 'lazy');
      if (!$img.attr('alt')) {
        $img.attr('alt', '帖子图片');
      }
    });
    
    // 规范化链接
    $elem.find('a').each((_: number, link: AnyNode) => {
      const $link = $(link);
      const href = $link.attr('href');
      if (href?.startsWith('http')) {
        $link.attr('target', '_blank');
        $link.attr('rel', 'noopener noreferrer');
      }
    });
  }
} 