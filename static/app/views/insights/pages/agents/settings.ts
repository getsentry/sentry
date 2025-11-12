import {t} from 'sentry/locale';
import {ModuleName} from 'sentry/views/insights/types';

export const AGENTS_LANDING_SUB_PATH = 'ai-agents';
export const AGENTS_LANDING_TITLE = t('Agents');
export const AGENTS_SIDEBAR_LABEL = t('Agents');

export const MODULES = [
  ModuleName.AGENT_MODELS,
  ModuleName.AGENT_TOOLS,
  ModuleName.AI_GENERATIONS,
];
