import { ExtractorConfig } from '../types/extractor';

export const defaultConfig: ExtractorConfig = {
  // 通用选择器
  selectors: {
    // 文章选择器
    article: [
      'article',
      '[role="article"]',
      '.article',
      '.post',
      '.entry',
      '.content',
      '.main',
      '#article',
      '#post',
      '#content',
      '#main',
      'main',
    ],
    
    // 标题选择器
    title: [
      'h1',
      '.title',
      '.post-title',
      '.article-title',
      '.entry-title',
      '.headline',
      '#title',
      'header h1',
      'article h1',
      '[role="heading"]',
    ],
    
    // 内容选择器
    content: [
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content-body',
      '.article-body',
      '.post-body',
      '.text',
      '#content',
      '[role="main"]',
      '[itemprop="articleBody"]',
    ],
    
    // 日期选择器
    date: [
      'time',
      '[datetime]',
      '[pubdate]',
      '.date',
      '.time',
      '.published',
      '.post-date',
      '.article-date',
      '.entry-date',
      '[itemprop="datePublished"]',
    ],
    
    // 作者选择器
    author: [
      '[rel="author"]',
      '.author',
      '.writer',
      '.byline',
      '.post-author',
      '.article-author',
      '.entry-author',
      '[itemprop="author"]',
    ],
  },
  
  // 清理规则
  clean: {
    // 移除的标签
    removeTags: [
      'script',
      'style',
      'iframe',
      'frame',
      'frameset',
      'noscript',
      'head',
      'meta',
      'link',
      'input',
      'textarea',
      'select',
      'button',
      'form',
      'nav',
      'header',
      'footer',
      'aside',
      'menu',
    ],
    
    // 保留的属性
    keepAttributes: [
      'src',
      'href',
      'alt',
      'title',
      'datetime',
      'pubdate',
      'width',
      'height',
      'loading',
      'rel',
      'target',
      'class',
      'id',
      'role',
      'aria-label',
      'itemprop',
    ],
    
    // 移除的类名
    removeClasses: [
      'hidden',
      'hide',
      'invisible',
      'ad',
      'advertisement',
      'banner',
      'social',
      'share',
      'related',
      'recommend',
      'sidebar',
      'widget',
      'comment',
      'reply',
      'footer',
      'header',
      'nav',
      'menu',
    ],
  },
  
  // 特殊内容处理
  special: {
    // 数学公式
    math: {
      inline: [
        '\\$[^\\$]+\\$',
        '\\\\\\([^\\)]+\\\\\\)',
      ],
      block: [
        '\\$\\$[^\\$]+\\$\\$',
        '\\\\\\[[^\\]]+\\\\\\]',
      ],
    },
    
    // 代码块
    code: {
      inline: [
        '`[^`]+`',
        '<code>[^<]+</code>',
      ],
      block: [
        '```[\\s\\S]+?```',
        '<pre>[\\s\\S]+?</pre>',
      ],
    },
    
    // 表格
    table: {
      selectors: [
        'table',
        '.table',
        '.data-table',
        '[role="table"]',
      ],
      required: [
        'thead',
        'tbody',
      ],
    },
  },
  
  // 评分权重
  weights: {
    // 标签权重
    tags: {
      article: 30,
      section: 25,
      main: 20,
      div: 5,
      p: 3,
      pre: 3,
      blockquote: 3,
      td: -3,
      form: -10,
      ol: 3,
      ul: 3,
      li: 1,
    },
    
    // 类名权重
    classes: {
      positive: {
        article: 25,
        content: 25,
        post: 25,
        text: 25,
        body: 25,
        main: 20,
        primary: 20,
        entry: 15,
        story: 15,
        blog: 15,
      },
      negative: {
        comment: -20,
        meta: -20,
        footer: -20,
        footnote: -20,
        sidebar: -15,
        widget: -15,
        share: -15,
        social: -15,
        nav: -15,
        menu: -15,
        advertisement: -30,
        banner: -30,
        ad: -30,
      },
    },
    
    // 内容权重
    content: {
      textLengthFactor: 0.3,
      linkDensityFactor: -0.5,
      imageFactor: 5,
      paragraphFactor: 3,
      headingFactor: 5,
    },
  },
  
  // 阈值设置
  thresholds: {
    // 最小文本长度
    minTextLength: 25,
    // 最大链接密度
    maxLinkDensity: 0.5,
    // 最小评分
    minScore: 20,
    // 最小段落数
    minParagraphs: 3,
    // 最小图片数
    minImages: 1,
  },
}; 