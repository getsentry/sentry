import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {hasMCPInsightsFeature} from 'sentry/views/insights/agentMonitoring/utils/features';
import {ModuleName} from 'sentry/views/insights/types';

export const AGENTS_LANDING_SUB_PATH = 'agents';
export const AGENTS_LANDING_TITLE = t('AI Agents');
const AGENTS_SIDEBAR_LABEL = t('AI Agents');
const AI_SIDEBAR_LABEL = t('AI');

// Returns AI if user has both MCP and agents, otherwise returns AI Agents
// TODO: Remove this once MCP is fully rolled out.
export const getAISidebarLabel = (organization: Organization) => {
  if (hasMCPInsightsFeature(organization)) {
    return AI_SIDEBAR_LABEL;
  }
  return AGENTS_SIDEBAR_LABEL;
};

export const MODULES = [ModuleName.AGENTS, ModuleName.MCP];

export const getAIModuleTitle = (organization: Organization) => {
  return getAISidebarLabel(organization);
};
