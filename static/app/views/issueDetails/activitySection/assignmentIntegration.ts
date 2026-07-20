import {t} from 'sentry/locale';
import type {GroupActivityAssigned} from 'sentry/types/group';

type AssignmentIntegration = GroupActivityAssigned['data']['integration'];

export function getAssignmentIntegrationName(integration: AssignmentIntegration) {
  switch (integration) {
    case 'msteams':
      return t('Microsoft Teams');
    case 'slack':
      return t('Slack');
    case 'projectOwnership':
      return t('Ownership Rule');
    case 'codeowners':
      return t('Codeowners Rule');
    case 'suspectCommitter':
      return t('Suspect Commit');
    default:
      return null;
  }
}

export function isAutoAssignmentIntegration(integration: AssignmentIntegration) {
  return (
    integration === 'projectOwnership' ||
    integration === 'codeowners' ||
    integration === 'suspectCommitter'
  );
}
