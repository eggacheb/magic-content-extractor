import { CheerioAPI as BaseCheerioAPI, Cheerio as BaseCheerio, AnyNode as BaseAnyNode, Element as BaseElement } from '@types/cheerio';

declare module 'cheerio' {
  export interface CheerioAPI extends BaseCheerioAPI {}
  export interface Cheerio<T> extends BaseCheerio<T> {}
  export interface AnyNode extends BaseAnyNode {}
  export interface Element extends BaseElement {}
  export type Root = CheerioAPI;
  
  export function load(
    content: string | AnyNode | AnyNode[] | Buffer,
    options?: {
      xml?: boolean;
      decodeEntities?: boolean;
      withStartIndices?: boolean;
      withEndIndices?: boolean;
      normalizeWhitespace?: boolean;
      xmlMode?: boolean;
      lowerCaseTags?: boolean;
      lowerCaseAttributeNames?: boolean;
      recognizeCDATA?: boolean;
      recognizeSelfClosing?: boolean;
    },
    isDocument?: boolean
  ): CheerioAPI;
}

export {}; 