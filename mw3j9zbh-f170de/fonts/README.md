# 字体

演示稿主题使用的字体，全部采用 [SIL Open Font License 1.1](https://openfontlicense.org)，可以随软件一起分发。各字体的许可证原文在 `LICENSES/` 目录。

哪套主题用哪些字体见 `packages/themes/src/index.ts`（主题清单的 `fonts`）。

| 字体 | 文件 | 来源 | 保留字体名 | 处理方式 |
| --- | --- | --- | --- | --- |
| Inter | `inter-*.woff2` | Google Fonts | 无 | Google Fonts 提供的 woff2 分片 |
| Noto Sans SC | `notosanssc-*.woff2` | Google Fonts | Source（不影响 Noto 名称） | 同上 |
| Noto Serif SC | `notoserifsc-*.woff2` | Google Fonts | 无 | 同上 |
| Noto Sans TC | `notosanstc-*.woff2` | Google Fonts | Source（不影响 Noto 名称） | 同上 |
| Noto Serif TC | `notoseriftc-*.woff2` | Google Fonts | 无 | 同上 |
| Archivo Black | `archivoblack-*.woff2` | Google Fonts | 无 | 同上 |
| Playfair Display | `PlayfairDisplay-VF.ttf`、`PlayfairDisplay-Italic-VF.ttf` | [google/fonts](https://github.com/google/fonts/tree/main/ofl/playfairdisplay) 发布的原版可变字体 | Playfair Display | **原样分发，未做任何修改**（仅文件改名） |
| Hanken Grotesk | `hankengrotesk-*.woff2` | Google Fonts | 无 | Google Fonts 提供的 woff2 分片 |
| Nunito | `nunito-*.woff2` | Google Fonts | 无 | 同上 |
| Newsreader | `newsreader-*.woff2`（正体、斜体） | Google Fonts | 无 | 同上 |
| Bricolage Grotesque | `bricolage-*.woff2` | Google Fonts | 无 | 同上 |
| Young Serif | `youngserif-*.woff2` | Google Fonts | 无 | 同上 |
| JetBrains Mono | `jetbrainsmono-*.woff2` | Google Fonts | 无 | 同上 |
| IBM Plex Sans | `IBMPlexSans-{Regular,Medium,SemiBold,Bold}-{Latin1,Latin2,Latin3,Pi}.woff2` | IBM 发布的 npm 包 [@ibm/plex-sans 1.1.0](https://www.npmjs.com/package/@ibm/plex-sans) 中的 `fonts/split/woff2/` | Plex | **原样分发，未做任何修改**：用的是 IBM 自己切好的分片，文件名与内容都没动 |
| Archivo | `archivo-*.woff2` | Google Fonts（[google/fonts](https://github.com/google/fonts/tree/main/ofl/archivo)，2026-11-03 下载，只取 wght 轴 100–900） | 无 | Google Fonts 提供的 woff2 分片；咨询研报（consult）的标题与数字 |
| Saira | `saira-*.woff2` | Google Fonts（[google/fonts](https://github.com/google/fonts/tree/main/ofl/saira)，2026-11-03 下载，只取 wght 轴 100–900） | 无 | Google Fonts 提供的 woff2 分片；科技蓝（techblue）的标题与数字 |
| Unbounded | `unbounded-*.woff2` | Google Fonts（v12，[googlefonts/unbounded](https://github.com/googlefonts/unbounded)，可变字体 200–900） | 无 | Google Fonts 提供的 woff2 分片，2026-11 下载；多巴胺（memphis）的数字与西文标题，五个分片合计约 215KB |
| 站酷庆科黄油体 ZCOOL QingKe HuangYou | `zcoolqingke-*.woff2`（92 个分片，约 2MB） | Google Fonts（[googlefonts/zcool-qingke-huangyou](https://github.com/googlefonts/zcool-qingke-huangyou)，Google Fonts 收录的 Regular，版权 2018 The ZCOOL QingKe HuangYou Project Authors） | 无 | Google Fonts 提供的 woff2 分片（2026-11 下载）；国潮主题的标题字体 |
| Quicksand | `Quicksand-VF.ttf` | [google/fonts](https://github.com/google/fonts/tree/main/ofl/quicksand) 的 `Quicksand[wght].ttf`（上游 [ThomasJockin/QuicksandFamily](https://github.com/ThomasJockin/QuicksandFamily) 提交 02ead1c，SHA-256 `39c9b642…77e1cc`），300–700 可变字体，2026-11-03 下载 | Quicksand | **原样分发，未做任何修改**（仅文件改名）；「清新」主题的英文和数字 |

## 规则

- OFL 把子集化、格式转换都视为「修改版本」。声明了保留字体名的字体，修改后不能沿用原名。所以这类字体只打包作者发布的原版文件，不自己切片或转换。
- 分片用 `tools/fonts/fetch-google-font.mjs` 下载，只用于没有保留字体名、或保留名与字体名无关的字体。
- 新增字体前先核对许可证：阿里巴巴普惠体、HarmonyOS Sans、MiSans、OPPO Sans、站酷高端黑等禁止修改或再分发，不能打包。详见 `docs/research/theme-trends.md` 第 5 节。

## 体积

- 正文中文只用思源黑体、思源宋体（简繁各一套分片，按 unicode-range 按需加载），各主题共用；一期没有新增中文字体，2026-11 的国潮标题字体见下。
  方案里「终端」主题提到的更纱黑体 Mono 没有打包：完整字体每个字重 20MB 以上，要自己做子集；
  幻灯片里中英混排不需要严格 2:1 等宽，终端主题的中文直接用思源黑体。
- 一期新增的七款西文字体（Hanken Grotesk、Nunito、Newsreader、Bricolage Grotesque、Young Serif、JetBrains Mono、IBM Plex Sans）合计约 1.2MB，
  浏览器只下载页面上实际用到的分片。
- 2026-11「清新」新增 Quicksand 一款（125KB 的整份 TTF，有保留字体名所以不切片），fonts.css 里给它写了西文的 unicode-range，只有中文的页面不会下载；中文仍用思源黑体。
- 思源黑体与 Inter 的分片本身就是 100–900 的可变字体，fonts.css 里按完整范围声明，柔光、极简白的细体大字才能用上。
- 2026-11 国潮主题加了站酷庆科黄油体（约 2MB，92 个分片，只有一个字重）：只有简体中文和西文，没有繁体字形，
  繁体演示稿里国潮的标题整句改用思源黑体 TC 粗体（deck.css），不会出现一句标题里两种字形混排。宋韵、黑金没有新增字体。
- `APS Punct Sans`、`APS Punct Serif` 不是新字体：只是给 Inter、Newsreader 已有的西文分片另起一个名字，unicode-range 只含弯引号、省略号这几个标点，
  英文演示稿里排在中文字体前面（deck.css），不用多下载文件。
