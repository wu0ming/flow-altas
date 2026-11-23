---
name: flow-atlas-maintenance
description: 使用已连接的 Flow Atlas 站点 MCP 维护个人信息流的节点、流程与连线。
---

在用户要求修改 Flow Atlas 时使用此流程。先调用 read_atlas 读取最新 revision、nodes、edges 和 groups。使用 schema 中公布的参数。若工具尚不可用，请用户在 ChatGPT 插件列表安装并连接其个人 Flow Atlas 插件。

1. 判断是新增工具、更新节点说明、调整信息流方向，还是调整流程分组。按节点 ID 和产品名称去重，复用现有记录。
2. 用 save_groups 建立必要流程，用 save_nodes 保存节点，用 save_edges 保存连接。每次传入完整记录及最新 revision。稳定 ID 仅含字母、数字、下划线或短横线。新节点默认 icon 为 grid，新流程默认 icon 为 route。记录使用通用、工作或生活标记。双向传递用 both=true。
3. 区分已使用、测试中、规划中、待核实。用户手稿未明确的信息流设为待核实。将状态记录在对应连线。label 填传递的信息，channelType 填插件、MCP、飞书官方接口等通道类型，channelName 填应用或服务名称。通道未知时留空。确知为跨域传递时，可用 fromDomain 和 toDomain 设置通道端点所在的处理域 ID。留空时跟随 group。不同层的同一工具始终使用同一节点 ID。有多种传递方式时分别建立连线。
4. 每次成功后采用返回的新 revision。遇到冲突，重新读取图谱，核对用户想改的字段后整合。多个操作分别报告成功或失败。
5. 删除前核对影响并获得用户确认。删除节点会移除关联连线；删除流程前需先迁移或删除其中的连线。
6. 再次调用 read_atlas 核对记录和方向，报告新增、修改、删除和仍待核实的内容。
