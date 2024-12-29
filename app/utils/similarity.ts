/**
 * 计算两个字符串的相似度(0-1)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  // 如果字符串相同,返回1
  if (str1 === str2) return 1;
  
  // 如果任一字符串为空,返回0
  if (!str1 || !str2) return 0;
  
  // 将字符串转换为小写并分词
  const words1 = str1.toLowerCase().split(/\s+/);
  const words2 = str2.toLowerCase().split(/\s+/);
  
  // 计算共同词的数量
  const commonWords = words1.filter(word => words2.includes(word));
  
  // 使用Dice系数计算相似度
  return (2 * commonWords.length) / (words1.length + words2.length);
}

/**
 * 计算最长公共子序列(LCS)
 */
export function getLCS(str1: string, str2: string): string {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
  
  // 构建DP表
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  // 回溯构建LCS
  let lcs = '';
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (str1[i - 1] === str2[j - 1]) {
      lcs = str1[i - 1] + lcs;
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  
  return lcs;
}

/**
 * 计算编辑距离
 */
export function getEditDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
  
  // 初始化
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // 计算编辑距离
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,  // 删除
          dp[i][j - 1] + 1,  // 插入
          dp[i - 1][j - 1] + 1  // 替换
        );
      }
    }
  }
  
  return dp[m][n];
} 