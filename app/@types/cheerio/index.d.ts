import { type CheerioAPI, type Cheerio, type Element as CheerioElement, type Node, type AnyNode, type BasicAcceptedElems } from 'cheerio';

// 扩展 CheerioOptions
declare module 'cheerio' {
  interface CheerioOptions {
    normalizeWhitespace?: boolean;
  }
}

// 导出常用类型
export type {
  CheerioAPI,
  Cheerio,
  CheerioElement,
  Node,
  AnyNode,
  BasicAcceptedElems
};

// 工具类型
export type CheerioSelector = string | Cheerio<CheerioElement> | CheerioElement | CheerioElement[];

// 扩展 Node 类型
export interface CheerioNode extends Node {
  type?: string;
  data?: string;
  next?: CheerioNode;
  prev?: CheerioNode;
  parent?: CheerioNode;
  children?: CheerioNode[];
  tagName?: string;
  attribs?: { [key: string]: string };
  name?: string;
  attributes?: { [key: string]: string };
}

// 类型转换函数
export function asCheerioNode(node: AnyNode): CheerioNode {
  return node as unknown as CheerioNode;
}

export function asElement(node: CheerioNode): CheerioElement {
  return node as unknown as CheerioElement;
} 