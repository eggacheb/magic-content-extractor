/**
 * 计算两个字符串的相似度
 * 使用 Levenshtein 距离算法
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) {
    return 0;
  }

  // 如果字符串相同，直接返回1
  if (str1 === str2) {
    return 1;
  }

  const len1 = str1.length;
  const len2 = str2.length;

  // 如果其中一个字符串为空，返回0
  if (len1 === 0 || len2 === 0) {
    return 0;
  }

  // 创建矩阵
  const matrix: number[][] = Array(len1 + 1).fill(0).map(() => Array(len2 + 1).fill(0));

  // 初始化第一行和第一列
  for (let i = 0; i <= len1; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // 填充矩阵
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,    // 删除
          matrix[i][j - 1] + 1,    // 插入
          matrix[i - 1][j - 1] + 1 // 替换
        );
      }
    }
  }

  // 计算相似度
  const maxLen = Math.max(len1, len2);
  const distance = matrix[len1][len2];
  
  return 1 - distance / maxLen;
}

/**
 * 计算两个字符串的最长公共子序列
 */
export function findLongestCommonSubsequence(str1: string, str2: string): string {
  if (!str1 || !str2) {
    return str1 || str2;
  }

  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = Array(len1 + 1).fill(0).map(() => Array(len2 + 1).fill(0));

  // 填充矩阵
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
      }
    }
  }

  // 回溯找出最长公共子序列
  let result = '';
  let i = len1, j = len2;
  while (i > 0 && j > 0) {
    if (str1[i - 1] === str2[j - 1]) {
      result = str1[i - 1] + result;
      i--;
      j--;
    } else if (matrix[i - 1][j] > matrix[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

/**
 * 计算两个字符串的最长公共子串
 */
export function findLongestCommonSubstring(str1: string, str2: string): string {
  if (!str1 || !str2) {
    return str1 || str2;
  }

  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = Array(len1 + 1).fill(0).map(() => Array(len2 + 1).fill(0));
  let maxLength = 0;
  let endIndex = 0;

  // 填充矩阵
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
        if (matrix[i][j] > maxLength) {
          maxLength = matrix[i][j];
          endIndex = i;
        }
      }
    }
  }

  return str1.slice(endIndex - maxLength, endIndex);
} 