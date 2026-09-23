# kmeans-forge · K-Means 聚类锻造炉

<p align="center">
  <a href="https://github.com/CJX0712/kmeans-forge/actions/workflows/ci.yml"><img src="https://github.com/CJX0712/kmeans-forge/actions/workflows/ci.yml/badge.svg" alt="ci"></a>
  <a href="https://github.com/CJX0712/kmeans-forge/releases"><img src="https://img.shields.io/github/v/release/CJX0712/kmeans-forge?sort=semver" alt="release"></a>
  <a href="https://github.com/CJX0712/kmeans-forge/blob/main/LICENSE"><img src="https://img.shields.io/github/license/CJX0712/kmeans-forge" alt="license"></a>
  <img src="https://img.shields.io/badge/author-%E6%99%A8%E6%98%9F-1f6feb" alt="author">
</p>

纯 JavaScript 手写的 **K-Means 聚类** 单文件实现，零框架、零依赖、零构建。
含 k-means++ 种子算法 + Lloyd 迭代，并用**独立实现的参照系**做交叉验证。

## 亮点
- 🔧 **全手写引擎**：高斯团生成、k-means++ 种子、Lloyd 迭代、SSE、1D 精确最优（动态规划）全部自研，算法透明可读。
- 🎯 **1D 精确下界（金标准）**：对 1D 数据用动态规划求出全局最优 K-Means SSE，K-Means 结果与之精确相等（误差 < 1e-6），验证算法正确性。
- ✅ **8 项硬不变量自检**：浏览器内一键运行，任何算法回归立即变红。
- 📊 **可视化**：2D 高斯团散点（真实标签 vs 预测）、SSE 衰减曲线、质心标记。

## 运行
直接用浏览器打开 `index.html` 即可。点击「运行 K-Means」生成数据并聚类，点击「运行自检」验证 8 项不变量。

## 硬不变量（交叉验证清单）
| # | 不变量 | 验证方式 |
|---|--------|----------|
| ① | SSE 单调不增 | Lloyd 算法定理：每次迭代 SSE 非增 |
| ② | 1D 精确下界 | 与动态规划全局最优 SSE 相等（<1e-6） |
| ③ | 标签恢复率 ≥95% | 多种子下与真实标签最佳排列匹配 |
| ④ | k-means++ 互异质心 | 返回 k 个互异种子 |
| ⑤ | 收敛不动点 | 终态用质心重分配，变化数 = 0 |
| ⑥ | 质心 = 均值参照 | 与暴力均值计算一致 |
| ⑦ | 缩放等变 | 坐标 ×正标量，分配模式不变 |
| ⑧ | SSE 有限非负 + 分配合法 | 数值健康、分配索引合法 |

## 无头测试
```bash
node _smoke.js   # 提取 <script id="engine"> 在 Node 中跑 8 项断言，需 8/8 绿
```

## 算法速览
- **k-means++**：第一个中心随机取；后续按 D² 加权概率选离已有中心最远的点，提升初始化质量、降低陷入局部最优概率。
- **Lloyd 迭代**：分配步（每点归最近中心）→ 更新步（中心取簇内均值），交替直至收敛。两步各自最小化 SSE，故 SSE 单调不增。
- **1D 精确最优**：对排序后的点，用 DP 求「划分为 k 个连续段」的最小 SSE，作为 K-Means 的解析金标准。

## 许可
MIT
