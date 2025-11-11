import {t} from 'sentry/locale';
import {ModuleName} from 'sentry/views/insights/types';

export const AGENTS_LANDING_SUB_PATH = 'ai';
export const AGENTS_LANDING_TITLE = t('AI Agents');
export const AI_SIDEBAR_LABEL = t('AI Agents');

export const MODULES = [
  ModuleName.AGENT_MODELS,
  ModuleName.AGENT_TOOLS,
  ModuleName.MCP,
  ModuleName.AI_GENERATIONS,
];
