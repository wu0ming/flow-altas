const groups = [
 ['capture','信息采集','入口','send'],
 ['research','分析与整理','处理','spark'],
 ['office','团队交付','协作','work'],
 ['knowledge','知识沉淀','归档','book'],
 ['memory','助手记忆','记忆','layers'],
 ['files','文件交换','文件','box']
];

const nodes = [
 ['inbox','剪藏收件箱','信息入口','通用','收集链接和临时材料。','send'],
 ['reading','阅读清单','阅读工具','生活','保存待阅读的文章。','book'],
 ['assistant','整理助手','AI 助手','通用','提取材料要点并辅助写作。','spark'],
 ['reviewer','复核助手','AI 助手','通用','复核摘要并补充遗漏。','bot'],
 ['archive','长期档案','知识库','通用','保存可以复用的结论和原始出处。','stack'],
 ['briefing','项目简报','工作文档','工作','汇总团队需要知道的进展。','work'],
 ['delivery','发布看板','协作平台','工作','交付简报并跟踪项目反馈。','grid'],
 ['memory-hub','共享记忆','记忆中枢','通用','保存助手可复用的工作背景。','core'],
 ['library','资料目录','资料库','通用','记录研究材料与文件位置。','book'],
 ['file-drop','临时文件夹','文件中转','通用','交换临时附件。','box'],
 ['index','主题索引','索引','通用','按主题组织可检索的知识。','net'],
 ['feedback','反馈列表','协作记录','工作','收集团队反馈。','mail']
];

const edges = [
 ['inbox','reading','整理待阅读的链接','capture','生活','已使用',false,'手动传递',''],
 ['inbox','library','保存原始来源','capture','通用','已使用',false,'API','示例采集接口'],
 ['library','assistant','传入资料及其出处','research','通用','已使用',false,'MCP','示例资料服务'],
 ['assistant','reviewer','发送摘要以供复核','research','通用','测试中',false,'API',''],
 ['assistant','briefing','提交已整理的结论','office','工作','已使用',false,'API','示例工作台'],
 ['briefing','delivery','交付项目简报','office','工作','已使用',false,'手动传递',''],
 ['delivery','feedback','记录交付反馈','office','工作','待核实',false,'',''],
 ['assistant','memory-hub','读写可复用的背景','memory','通用','已使用',true,'MCP','示例记忆服务'],
 ['reviewer','memory-hub','查阅统一的项目背景','memory','通用','测试中',false,'MCP','示例记忆服务'],
 ['briefing','archive','沉淀经过复核的结论','knowledge','通用','已使用',false,'API','示例归档接口','office','knowledge'],
 ['archive','index','建立可检索的主题入口','knowledge','通用','规划中',false,'API',''],
 ['file-drop','library','交接附件与来源信息','files','通用','已使用',false,'文件传输','示例文件通道'],
 ['file-drop','delivery','补充用于交付的附件','files','工作','规划中',false,'文件传输','']
];

export const seed = {
 revision:0,
 groups:groups.map(([id,name,short,icon])=>({id,name,short,icon})),
 nodes:nodes.map(([id,name,type,scope,note,icon])=>({id,name,type,scope,note,icon})),
 edges:edges.map(([from,to,label,group,scope,status,both,channelType,channelName,fromDomain='',toDomain=''],i)=>({
  id:'demo-'+(i+1),from,to,label,group,scope,status,both,channelType,channelName,fromDomain,toDomain
 }))
};
