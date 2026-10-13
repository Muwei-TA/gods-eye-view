# 简体中文使用说明

在左上角的语言菜单中选择 **简体中文** 或 **English**。首次启动时会根据浏览器语言选择；已保存的偏好优先，刷新后仍然有效。正常切换会重载当前页面并保留 URL 中的分享参数，未写入分享链接的临时状态可能重置。

无需 API 密钥即可启动：

```sh
npm ci
npm run doctor
npm run dev
```

中文覆盖应用自己的界面、首次启动引导、图层、显示控制、面板、数据源配置和常见提示。呼号、地名、广播名称、数据源品牌、第三方新闻、原始错误详情及用户创建的内容保持原样。语音模型的回答语言由会话决定。

浏览器阻止本地存储时，语言选择仍会更新当前页面的静态文案及随后生成的动态提示，但无法保存偏好；此时不会重载页面。部分启动时创建的标签会保留原语言，建议允许此站点使用本地存储后重新选择。

中文字体会回退到系统中的苹方、微软雅黑或 Noto Sans CJK。核心图标使用内置字体，无需外网；地图、可选英文字体及实时数据源仍需能够访问对应的外部服务。

开发验证：

```sh
node scripts/check-i18n.mjs
node --test src/i18n/*.test.mjs
# 先启动开发服务；预装 Chromium 的环境可设置此路径。
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium node scripts/qa-i18n.mjs
```

新增文案请使用 `src/i18n/messages.js` 中的稳定键。动态文案调用 `translate(key, parameters)`；模板只在文本叶子节点上标记 `data-i18n`，属性使用 `data-i18n-title`、`data-i18n-placeholder` 或 `data-i18n-aria-label`。不要翻译业务标识、Material Symbols 图标名称或密钥变量名。
