# Flow Atlas

- 改动图谱结构时优先复用 `server/api.mjs` 中的记录校验与版本检查。同步检查页面编辑、MCP 和 JSON 导出。
- 提交前执行 `npm run build` 和 `npm test`。
- 发布到公共仓库时使用虚构的演示数据。把私人图谱、部署标识和凭据保存在各自的运行环境。
- 通过 MCP 维护图谱时使用 [.agents/skills/flow-atlas-maintenance/SKILL.md](.agents/skills/flow-atlas-maintenance/SKILL.md)。
