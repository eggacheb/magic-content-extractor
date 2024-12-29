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

// 基本的 Cheerio 节点类型
export interface CheerioNode {
  // 节点类型
  type: 'tag' | 'text' | 'comment' | 'script' | 'style' | 'cdata';
  // 节点名称
  name: string;
  // 标签名称 (用于元素节点)
  tagName?: string;
  // 节点数据 (用于文本和注释节点)
  data?: string;
  // 节点值
  nodeValue: string | null;
  // 属性
  attribs: { [key: string]: string };
  // DOM 属性别名
  attributes?: { [key: string]: string };
  // 节点关系
  parent: CheerioNode | null;
  prev: CheerioNode | null;
  next: CheerioNode | null;
  // 子节点
  children: CheerioNode[];
  childNodes: CheerioNode[];
  firstChild: CheerioNode | null;
  lastChild: CheerioNode | null;
}

// 类型转换函数
export function asCheerioNode(node: AnyNode): CheerioNode {
  return node as unknown as CheerioNode;
}

export function asElement(node: CheerioNode): CheerioElement {
  return node as unknown as CheerioElement;
} 