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
- 支持在线部署
- 可选 Supabase 云端收集多人评分结果

## 技术栈

- React
- Vite
- TypeScript
- CSS
- `<model-viewer>` for `.glb` preview
- 可选 Supabase for shared online submission storage

## 本地运行

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:5173
```

## 本地构建

```bash
npm run build
npm run preview
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

### 方案 A：Vercel，推荐

1. 把项目推送到 GitHub 仓库。
2. 登录 Vercel。
3. Import Git Repository。
4. Framework 选择 Vite。
5. Build Command 使用：

```bash
npm run build
```

6. Output Directory 使用：

```text
dist
```

7. 部署完成后，把 Vercel 提供的网址发给评测者。

### 方案 B：Netlify

Build command：

```bash
npm run build
```

Publish directory：

```text
dist
```

### 方案 C：GitHub Pages

如果仓库名为 `trellis-attack-eval`，构建前设置 base path：

```bash
VITE_BASE_PATH=/trellis-attack-eval/ npm run build
```

然后把 `dist/` 发布到 GitHub Pages。

## 多人在线评分结果集中保存

如果只部署静态网页，别人可以在线访问和操作，但评分结果默认保存在各自浏览器的 localStorage 中，无法自动汇总到你这里。

要集中收集多人评分结果，推荐配置 Supabase：

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
