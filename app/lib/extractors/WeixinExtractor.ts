import { BaseExtractor } from '../BaseExtractor';
import { type CheerioAPI, type CheerioNode, type CheerioElement, asCheerioNode, asElement } from '@/types/cheerio';
import { WEIXIN_SELECTORS } from '../../types/extractor';

export class WeixinExtractor extends BaseExtractor {
  public canHandle(url: string): boolean {
    return /mp\.weixin\.qq\.com/.test(url);
  }
  
  protected getCustomSelectors(): string[] {
    return [
      WEIXIN_SELECTORS.content,
      WEIXIN_SELECTORS.content_area
    ];
  }
  
  protected postProcess(element: CheerioNode): void {
    super.postProcess(element);
    
    const $ = this.$;
    const $elem = $(asElement(element));
    
    // 移除付费墙
    $elem.find(WEIXIN_SELECTORS.pay_wall).remove();
    
    // 处理图片
    $elem.find('img').each((_: number, img: CheerioElement) => {
      const $img = $(img);
      const dataSrc = $img.attr('data-src');
      if (dataSrc) {
        $img.attr('src', dataSrc);
      }
    });
  }
} 