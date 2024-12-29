import { NextResponse } from 'next/server';
import { ExtractorFactory } from '@/app/lib/ExtractorFactory';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    // 获取页面内容
    const response = await fetch(targetUrl);
    const html = await response.text();

    // 初始化提取器工厂并设置配置选项
    ExtractorFactory.init({
      minTextLength: 25,
      retryLength: 250,
      includeComments: false
    });

    // 使用提取器工厂获取合适的提取器
    const extractor = ExtractorFactory.getExtractor(targetUrl);

    const result = await extractor.extract(html, targetUrl);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error processing URL:', error);
    return NextResponse.json(
      { error: 'Failed to process URL' },
      { status: 500 }
    );
  }
} 