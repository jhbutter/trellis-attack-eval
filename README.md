# Trellis Adversarial Attack Evaluation Platform

一个用于评估 Trellis 单图 3D 重建流程中对抗攻击效果的在线主观评测平台 Demo。

## 已实现功能

- 自动生成 16 类 × 50 样本 = 800 条 Demo 样本元数据
- 自动划分 80 个批次，每批 10 个样本
- 随机抽取批次
- 原图 `ori.png` 与对抗图 `adv.png` 并排展示
- 支持滑动式图像对比
- 支持 `.glb` 交互式查看：
  - `gt.glb`
  - `recon_ori.glb`
  - `recon_adv.glb`
- 两个主观评分维度：
  - 攻击隐蔽性 Visual Stealthiness
  - 攻击有效性 Attack Effectiveness
- 未评分不得提交
- 当前批次进度显示
- 单样本评分暂存与刷新恢复
- 批次提交
- 结果页查看提交记录
- CSV / JSON 导出
- 缺失文件 fallback 到 placeholder
- 支持在 `192.168.112.249:7861` 这类服务器地址在线访问
- 服务器端 SQLite 集中保存多人评分结果
- 可选 Supabase 云端收集多人评分结果

## 技术栈

- React
- Vite
- TypeScript
- CSS
- `<model-viewer>` for `.glb` preview
- Python 标准库 HTTP server
- SQLite for shared server-side result storage
- 可选 Supabase for shared online submission storage

## 服务器运行

```bash
npm install
npm run build
npm run serve
```

打开：

```text
http://192.168.112.249:7861
```


服务默认监听：

```text
0.0.0.0:7861
```

评分结果保存到：

```text
data/evaluation.sqlite3
```

CSV 导出地址：

```text
http://192.168.112.249:7861/api/export.csv
```

## 真实数据接入方式

把真实文件放到：

```text
public/dataset/{category}/{sample_index}/
```

例如：

```text
public/dataset/A1/0001/ori.png
public/dataset/A1/0001/adv.png
public/dataset/A1/0001/gt.glb
public/dataset/A1/0001/recon_ori.glb
public/dataset/A1/0001/recon_adv.glb
```

每个样本目录建议包含：

```text
ori.png
adv.png
gt.glb
recon_ori.glb
recon_adv.glb
metadata.json
```

当前 Demo 会自动尝试这些路径。如果文件不存在，会 fallback 到：

```text
public/placeholder/ori.png
public/placeholder/adv.png
public/placeholder/demo.glb
```

## 让其他人在线访问

在 `192.168.112.249` 服务器上执行：

```bash
npm run build
npm run serve
```

然后把下面地址发给评测者：

```text
http://192.168.112.249:7861
```

如果其他机器无法访问，请检查服务器防火墙或云服务器安全组是否开放 TCP `7861` 端口。

后台 API：

```text
GET  /api/summary
GET  /api/batch/random
GET  /api/batch/{batch_id}
POST /api/submissions
GET  /api/submissions
GET  /api/export.csv
```

## 静态部署备选

如果只部署静态网页，例如 Vercel、Netlify、GitHub Pages，别人仍然可以在线访问和操作，但默认只能保存到各自浏览器 localStorage。要集中收集结果，请使用本仓库的 `server.py` 或配置 Supabase。

Vercel / Netlify build command：

```bash
npm run build
```

Publish directory：

```text
dist
```

## 多人在线评分结果集中保存

使用 `npm run serve` 时，所有评测者的提交会写入服务器 SQLite，并可通过结果页或 `/api/export.csv` 汇总导出。

如果使用纯静态部署，也可以配置 Supabase：

1. 创建 Supabase project。
2. 打开 SQL Editor。
3. 执行：

```text
supabase/schema.sql
```

4. 在部署平台添加环境变量：

```text
VITE_SUPABASE_URL=你的 Supabase Project URL
VITE_SUPABASE_ANON_KEY=你的 Supabase anon public key
```

5. 重新部署。

启用后，每次批次提交会：

- 写入本地浏览器，作为本地备份
- 同时写入 Supabase 表 `ratings_submissions`

## 结果导出

在结果页点击：

- 导出 CSV
- 导出 JSON

CSV 字段：

```text
submission_id, session_id, user_id, batch_id, sample_id, category, sample_index,
visual_stealthiness, attack_effectiveness, comment, started_at, submitted_at
```

## 后续建议

- 添加用户登录或评测者邀请码
- 添加管理员后台
- 添加批次分配策略，避免多人重复评测同一批次
- 添加 attention check 样本
- 添加重复样本一致性检查
- 添加评分均值、方差、置信区间统计
- 添加不同类别、攻击方法、epsilon 的分组分析
- 使用对象存储保存大量 `.glb` 文件，例如 Supabase Storage、S3、Cloudflare R2
