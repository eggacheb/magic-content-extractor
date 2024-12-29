import { BaseExtractor } from '../BaseExtractor';
import { type CheerioAPI, type CheerioNode, type CheerioElement, type Cheerio, asCheerioNode, asElement } from '../../types/cheerio';
import { FORUM_SELECTORS } from '../../types/extractor';

interface ForumPost {
  author: string;
  publishTime: string;
  content: string;
  likes: number;
}

export class ForumExtractor extends BaseExtractor {
  protected postProcess(element: CheerioNode): void {
    super.postProcess(element);
    
    const $elem = this.$(asElement(element));
    
    // 处理引用
    $elem.find(FORUM_SELECTORS.quote).each((_: number, quote: CheerioElement) => {
      const $quote = this.$(quote);
      $quote.addClass('forum-quote');
    });
    
    // 处理附件
    $elem.find(FORUM_SELECTORS.attachment).each((_: number, attachment: CheerioElement) => {
      const $attachment = this.$(attachment);
      $attachment.addClass('forum-attachment');
    });
    
    // 处理投票
    $elem.find(FORUM_SELECTORS.poll).each((_: number, poll: CheerioElement) => {
      const $poll = this.$(poll);
      $poll.addClass('forum-poll');
    });
    
    // 处理评分
    $elem.find(FORUM_SELECTORS.rating).each((_: number, rating: CheerioElement) => {
      const $rating = this.$(rating);
      $rating.addClass('forum-rating');
    });
    
    // 处理图片
    $elem.find('img').each((_: number, img: CheerioElement) => {
      const $img = this.$(img);
      $img.addClass('forum-image');
    });
    
    // 处理链接
    $elem.find('a').each((_: number, link: CheerioElement) => {
      const $link = this.$(link);
      $link.addClass('forum-link');
    });
  }
  
  private extractAuthor($elem: Cheerio<CheerioElement>): string {
    return $elem.find(FORUM_SELECTORS.authorName).first().text().trim();
  }
  
  private extractPublishTime($elem: Cheerio<CheerioElement>): string {
    return $elem.find(FORUM_SELECTORS.date).first().text().trim();
  }
  
  private extractLikes($elem: Cheerio<CheerioElement>): number {
    const likesText = $elem.find(FORUM_SELECTORS.likes).first().text().trim();
    return parseInt(likesText.replace(/[^\d]/g, '')) || 0;
  }
  
  private mergeContent(mainPost: ForumPost, replies: ForumPost[]): CheerioNode {
    const $ = this.$;
    const $container = $('<div class="forum-thread"></div>');
    
    // 添加主帖
    $container.append(`
      <div class="forum-post main-post">
        <div class="post-meta">
          <span class="author">${mainPost.author}</span>
          <span class="time">${mainPost.publishTime}</span>
          <span class="likes">${mainPost.likes} likes</span>
        </div>
        <div class="post-content">${mainPost.content}</div>
      </div>
    `);
    
    // 添加回复
    if (replies.length > 0) {
      const $replies = $('<div class="forum-replies"></div>');
      replies.forEach(reply => {
        $replies.append(`
          <div class="forum-post reply">
            <div class="post-meta">
              <span class="author">${reply.author}</span>
              <span class="time">${reply.publishTime}</span>
              <span class="likes">${reply.likes} likes</span>
            </div>
            <div class="post-content">${reply.content}</div>
          </div>
        `);
      });
      $container.append($replies);
    }
    
    return asCheerioNode($container[0] as CheerioElement);
  }
} 