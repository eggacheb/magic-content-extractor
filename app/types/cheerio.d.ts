import type { CheerioAPI, Cheerio, Element, AnyNode } from 'cheerio';

declare module 'cheerio' {
  export { CheerioAPI, Cheerio, Element, AnyNode };
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