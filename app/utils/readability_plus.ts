import { type CheerioAPI, type CheerioNode, type CheerioElement, asCheerioNode, asElement } from '../@types/cheerio';
import { cleanHtml, calculateTextLength, isMediaNode, hasVisibleContent, hasValidLinks, scoreElement, normalizeText, normalizeMedia } from './extractor';

export interface ReadabilityOptions {
  minTextLength?: number;
  minScore?: number;
  cleanOptions?: {
    removeScripts?: boolean;
    removeStyles?: boolean;
    removeComments?: boolean;
  };
}

export class ReadabilityPlus {
  private $: CheerioAPI;
  private options: ReadabilityOptions;
  
  constructor($: CheerioAPI, options: ReadabilityOptions = {}) {
    this.$ = $;
    this.options = {
      minTextLength: options.minTextLength || 25,
      minScore: options.minScore || 20,
      cleanOptions: {
        removeScripts: true,
        removeStyles: true,
        removeComments: true,
        ...options.cleanOptions
      }
    };
  }
  
  public parse(): CheerioNode | null {
    // 清理HTML
    cleanHtml(this.$, this.options.cleanOptions);
    
    // 获取所有可能的内容容器
    const candidates = this.getCandidates();
    
    if (candidates.length === 0) {
      return null;
    }
    
    // 选择最佳候选者
    const bestCandidate = this.selectBestCandidate(candidates);
    
    if (!bestCandidate) {
      return null;
    }
    
    // 规范化内容
    this.normalizeContent(bestCandidate);
    
    return bestCandidate;
  }
  
  private getCandidates(): CheerioNode[] {
    const candidates: CheerioNode[] = [];
    const $ = this.$;
    
    $('article, main, section, div').each((_: number, element: CheerioElement) => {
      const node = asCheerioNode(element);
      if (this.isValidCandidate(node)) {
        candidates.push(node);
      }
    });
    
    return candidates;
  }
  
  private isValidCandidate(node: CheerioNode): boolean {
    const textLength = calculateTextLength(this.$, node);
    
    if (textLength < this.options.minTextLength!) {
      return false;
    }
    
    if (!hasVisibleContent(this.$, node)) {
      return false;
    }
    
    if (!hasValidLinks(this.$, node)) {
      return false;
    }
    
    const score = scoreElement(this.$, node);
    return score >= this.options.minScore!;
  }
  
  private selectBestCandidate(candidates: CheerioNode[]): CheerioNode | null {
    if (candidates.length === 0) {
      return null;
    }
    
    let bestCandidate = candidates[0];
    let bestScore = scoreElement(this.$, bestCandidate);
    
    for (let i = 1; i < candidates.length; i++) {
      const candidate = candidates[i];
      const score = scoreElement(this.$, candidate);
      
      if (score > bestScore) {
        bestCandidate = candidate;
        bestScore = score;
      }
    }
    
    return bestCandidate;
  }
  
  private normalizeContent(node: CheerioNode): void {
    normalizeText(this.$, node);
    normalizeMedia(this.$, node);
  }
} 