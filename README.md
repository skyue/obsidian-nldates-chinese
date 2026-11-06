# Natural Language Dates — Chinese

An Obsidian plugin for inserting date links and opening daily notes using natural language in Simplified or Traditional Chinese.

Type `@今天` (today), `@下周二` (next Tuesday), or `@3天后` (in three days). Every suggestion previews its exact date. Ambiguous expressions such as `@周二` offer this, next, and previous week; the link alias preserves your original input. Press Enter to insert a date link, or Shift+Enter for a link without an alias.

Traditional holidays use offline lunar calendar conversion. Spring Festival, Lantern Festival, Dragon Boat Festival, Qixi, Mid-Autumn Festival, Double Ninth Festival, Laba, Lunar New Year's Eve, Qingming and Winter Solstice are supported for Gregorian years 1900–2100. Explicit years produce one result; bare holiday names offer adjacent years. Official vacation schedules and compensatory workdays are not included.

Install from Obsidian Community Plugins by searching for **Natural Language Dates - Chinese**, or copy `main.js` and `manifest.json` from the latest GitHub release into `.obsidian/plugins/nldates-chinese/` and enable the plugin. Requires Obsidian 1.12.0 or later.

Settings include date format, week start, trigger character and link output. Commands also support parsing selected text and opening a daily note. Development: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

---

# 自然语言日期（中文）

Obsidian 插件，支持使用中文自然语言输入日期，快速插入日期链接或打开日记。

## 功能

输入 `@` 触发日期建议菜单，或使用命令解析选中的中文日期文本。

<img width="474" height="244" alt="gif-26062020" src="https://github.com/user-attachments/assets/a9ded44e-2641-4e4e-8ae8-8d750b3d355d" />


同时支持**简体中文**和**繁体中文**（如「週五」「下週三」「禮拜一」「勞動節」等）。

支持以下中文日期表达：

- **相对日期**：今天、明天、后天、大后天、昨天、前天、大前天
- **星期**：周一~周日、下周一、上周三、这周、下周、上周
- **月份**：本月、下个月、上个月、月底、月中
- **年份**：今年、明年
- **数量+单位**：3天后、五天前、2周后、1个月后
- **序数词**：第一~第三十一
- **节日**：元旦、国庆、劳动节、中秋、端午、圣诞等
- **数字日期**：2024-01-15、1月15日

### 歧义日期候选

输入 `@周二` 时提供本周二、下周二、上周二；输入 `@8号` 时提供本月、下月、上月8日。无年份的月日、月初/月中/月末、年初/年末和固定公历节日也提供相邻周期候选，所有候选（包括今天、下周二、3天后等单一结果）都同时展示实际日期。不存在的日期会被省略。

选择候选后，链接别名保留 `@` 后的原始输入，例如选择上周二仍插入 `[[实际日期|周二]]`。Shift+Enter 插入不带别名的链接。传统节日支持离线农历转换：春节、元宵、端午、七夕、中秋、重阳、腊八、除夕，以及清明、冬至。裸节日提供今年、明年、去年候选，明确年份只提供一个结果。年份指节日所在的公历年份，支持1900—2100年；暂不支持调休及放假区间。

## 命令

| 命令 | 说明 |
|------|------|
| 解析自然语言日期 | 将选中的中文日期替换为 `[[日期\|别名]]` 链接 |
| 解析自然语言日期（纯文本） | 将选中的中文日期替换为纯日期文本 |
| 用自然语言打开日记 | 输入中文日期后跳转到对应日记 |

## 设置

- **日期格式**：输出日期的 Moment.js 格式，默认 `YYYY-MM-DD`
- **一周从周几开始**：影响"本周""下周"等计算
- **触发字符**：触发自动建议的字符，默认 `@`
- **日期包裹为链接**：开启后自动建议的日期会包裹在 `[[]]` 中
- **链接默认别名格式**：创建 Wiki 链接时的别名格式（Moment.js 格式），如 `MM月DD日`。用于命令等入口；`@` 自动建议始终使用原始输入作为别名

## 使用技巧

在 `@` 弹出的建议菜单中：
- **直接回车**：插入带别名的日期链接（别名格式由设置决定）
- **Shift+Enter**：插入纯日期链接，不使用别名

## 安装

### 社区插件市场

在 Obsidian 社区插件市场搜索「自然语言日期（中文）」安装。

### 手动安装

1. 下载 `main.js` 和 `manifest.json`
2. 放入 vault 的 `.obsidian/plugins/nldates-chinese/` 目录
3. 在设置中启用插件

## 开发

```bash
npm install
npm run dev   # 开发模式，自动监听文件变化
npm run build # 构建
```
