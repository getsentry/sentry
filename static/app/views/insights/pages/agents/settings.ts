import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {hasMCPInsightsFeature} from 'sentry/views/insights/agentMonitoring/utils/features';
import {ModuleName} from 'sentry/views/insights/types';

export const AGENTS_LANDING_SUB_PATH = 'agents';
export const AGENTS_LANDING_TITLE = t('AI Agents');
const AGENTS_SIDEBAR_LABEL = t('AI Agents');
const AI_SIDEBAR_LABEL = t('AI');

export const getAgentsSidebarLabel = (organization: Organization) => {
  if (hasMCPInsightsFeature(organization)) {
    return AI_SIDEBAR_LABEL;
  }
  return AGENTS_SIDEBAR_LABEL;
};

export const MODULES = [ModuleName.AGENTS];
