import type {Block} from './types';

export function getToolsStringFromBlock(block: Block): string[] {
  // TODO custom displays for each tool
  const tools: string[] = [];
  for (const tool of block.message.tool_calls || []) {
    tools.push('Used ' + tool.function + ' tool');
  }
  return tools;
}
