# Harness

从零实现的 Agent 执行框架（Harness），TypeScript + ESM。

## 快速开始

```bash
npm install
cp .env.example .env   # 填入你的 LLM_API_KEY
npm start "你好"        # 单条消息模式
npm run dev            # 交互模式
npm test               # 契约测试
npm run typecheck      # 类型检查
```

## 架构

- `src/main.ts` — CLI 入口 + 焊死内核：四大契约类型、合并引擎、assembleRegistry、createAgent 门面、裸 agent loop、OpenAI 兼容默认 LLM
- `custom/` — （暂未启用）用户自定义实现层，后续引入 overrides 时会作为用户注册点
- `tests/` — 契约测试

## 覆盖语义

- 函数值 → 调用，传入 `(cfg, prev)`，返回值作为覆盖
- 对象值 → 浅合并
- 其他 → 直接替换
- `tools.items` → 追加语义
