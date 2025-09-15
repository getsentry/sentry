import type {Block} from './types';

export function getToolsStringFromBlock(block: Block): string[] {
  // TODO custom displays for each tool
  const tools: string[] = [];
  if (block.tool_input?.function) {
    tools.push('Used ' + block.tool_input.function + ' tool');
  }
  return tools;
}
