import {t} from 'sentry/locale';
import {ActionType} from 'sentry/types/workflowEngine/actions';

type TicketActionMetadata = {
  link?: string;
  ticketType?: string;
};

export const ticketActionMetadataMap = new Map<ActionType, TicketActionMetadata>([
  [
    ActionType.AZURE_DEVOPS,
    {
      ticketType: t('an Azure DevOps work item'),
      link: 'https://docs.sentry.io/product/integrations/source-code-mgmt/azure-devops/#issue-sync',
    },
  ],
  [
    ActionType.GITHUB,
    {
      ticketType: t('a GitHub issue'),
    },
  ],
  [
    ActionType.GITHUB_ENTERPRISE,
    {
      ticketType: t('a GitHub Enterprise issue'),
    },
  ],
  [
    ActionType.JIRA,
    {
      ticketType: t('a Jira issue'),
      link: 'https://docs.sentry.io/product/integrations/issue-tracking/jira/#issue-sync',
    },
  ],
  [
    ActionType.JIRA_SERVER,
    {
      ticketType: t('a Jira Server issue'),
      link: 'https://docs.sentry.io/product/integrations/issue-tracking/jira/#issue-sync',
    },
  ],
]);
