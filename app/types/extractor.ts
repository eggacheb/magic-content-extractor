import type { Root, Element, AnyNode } from 'cheerio';

export interface ExtractResult {
  title: string;
  content: string;
  textContent: string;
  html: string;
  url: string;
  metadata?: {
    author?: string;
    publishTime?: string;
    readCount?: number;
    likeCount?: number;
    platform?: 'weixin' | 'article' | 'forum';
    [key: string]: any;
  };
}

export interface ExtractorOptions {
  minTextLength?: number;
  retryLength?: number;
  includeComments?: boolean;
  minScore?: number;
}

export interface CleanOptions {
  removeScripts?: boolean;
  removeStyles?: boolean;
  removeComments?: boolean;
}

// 网站类型
export type WebsiteType = 'article' | 'forum' | 'weixin';

// 网站提取器接口
export interface SiteExtractor {
  canHandle(url: string): boolean;
  getCustomSelectors(): string[];
  preProcess($: Root): void;
  postProcess($: Root): void;
}

// 主要内容选择器
export const CONTENT_SELECTORS = [
  // 文章选择器
  'article',
  '.post',
  '.entry',
  '.post-text',
  '.post-body',
  '.post-content',
  '.article-text',
  '.article-body',
  '.article-content',
  '[itemprop="articleBody"]',
  '.entry-content',
  '.page-content',
  '.text-content',
  // 博客选择器
  '.blog-post',
  '.blog-entry',
  '.blog-content',
  // 新闻选择器
  '.news-content',
  '.news-text',
  '.news-article',
  // 通用选择器
  'main',
  '#main-content',
  '.main-content',
  '.content-body',
  '.content-text',
  '[role="main"]',
  // 自定义属性
  '[itemprop="text"]',
  '[itemprop="description"]',
  '[property="og:description"]',
] as const;

// 需要移除的元素选择器
export const NOISE_SELECTORS = [
  // 评论相关
  '.comment',
  '.comments',
  '#comments',
  '.comment-list',
  '.comment-content',
  // 页面结构
  '.header',
  '.footer',
  '.sidebar',
  '.widget',
  // 导航相关
  '.navigation',
  '.nav',
  '.navbar',
  '.menu',
  '.breadcrumb',
  // 广告相关
  '.advertisement',
  '.ad',
  '.ads',
  '.adsense',
  '[id*="ad-"]',
  '[class*="ad-"]',
  // 社交分享
  '.social',
  '.share',
  '.sharing',
  '.social-share',
  // 相关内容
  '.related',
  '.recommended',
  '.popular',
  '.trending',
  // 作者信息
  '.author-info',
  '.author-bio',
  '.author-meta',
  // 元信息
  '.meta',
  '.metadata',
  '.post-meta',
  '.article-meta',
  // 标签和分类
  '.tags',
  '.categories',
  '.taxonomy',
  // 订阅和通知
  '.subscribe',
  '.newsletter',
  '.notification',
  // 版权信息
  '.copyright',
  '.license',
  // 弹窗和遮罩
  '.modal',
  '.overlay',
  '.popup',
  // 隐藏元素
  '[style*="display: none"]',
  '[style*="visibility: hidden"]',
  '[hidden]',
  '.hidden',
] as const;

// 微信文章特定的选择器
export const WEIXIN_SELECTORS = {
  content: '#img-content',
  profile: '#meta_content',
  tags: '#js_tags',
  profileCard: '.wx_profile_card_inner',
  profileMsg: '.wx_profile_msg_inner',
  // 添加更多微信特定选择器
  title: '#activity-name',
  author: '#js_name',
  publishTime: '#publish_time',
  readNum: '#js_read_num',
  likeNum: '#js_like_num',
  content_area: '.rich_media_content',
  pay_wall: '.pay_wall_wrap',
} as const;

// 论坛特定的选择器
export const FORUM_SELECTORS = {
  // 帖子内容
  post: '.post-content, .message-content, .thread-content, .topic-content',
  firstPost: '.first-post, .initial-post, .opening-post',
  replies: '.replies, .comments, .responses',
  // 用户信息
  author: '.author-info, .user-info, .poster-info',
  authorName: '.username, .user-name, .author-name',
  authorAvatar: '.avatar, .user-avatar, .author-avatar',
  // 时间信息
  date: '.post-time, .message-time, .publish-time',
  lastUpdate: '.last-update, .edit-time, .modified-time',
  // 标题相关
  title: '.thread-title, .post-title, .topic-title',
  subtitle: '.thread-subtitle, .post-subtitle',
  // 统计信息
  views: '.view-count, .views, .read-count',
  replies_count: '.reply-count, .response-count',
  likes: '.like-count, .appreciation-count',
  // 特殊元素
  sticky: '.sticky, .pinned, .topped',
  locked: '.locked, .closed',
  solved: '.solved, .resolved',
  // 引用和附件
  quote: '.quote, .quoted-content, .referenced-content',
  attachment: '.attachment, .attached-file',
  // 投票和评分
  poll: '.poll, .vote, .survey',
  rating: '.rating, .score, .reputation',
} as const;

// 配置类型定义
export interface ExtractorConfig {
  // 选择器配置
  selectors: {
    article: string[];
    title: string[];
    content: string[];
    date: string[];
    author: string[];
  };
  
  // 清理规则
  clean: {
    removeTags: string[];
    keepAttributes: string[];
    removeClasses: string[];
  };
  
  // 特殊内容处理
  special: {
    // 数学公式
    math: {
      inline: string[];
      block: string[];
    };
    
    // 代码块
    code: {
      inline: string[];
      block: string[];
    };
    
    // 表格
    table: {
      selectors: string[];
      required: string[];
    };
  };
  
  // 评分权重
  weights: {
    // 标签权重
    tags: {
      [key: string]: number;
    };
    
    // 类名权重
    classes: {
      positive: {
        [key: string]: number;
      };
      negative: {
        [key: string]: number;
      };
    };
    
    // 内容权重
    content: {
      textLengthFactor: number;
      linkDensityFactor: number;
      imageFactor: number;
      paragraphFactor: number;
      headingFactor: number;
    };
  };
  
  // 阈值设置
  thresholds: {
    minTextLength: number;
    maxLinkDensity: number;
    minScore: number;
    minParagraphs: number;
    minImages: number;
  };
}