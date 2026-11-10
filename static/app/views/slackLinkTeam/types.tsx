import type {OrganizationSummary} from 'sentry/types/organization';

export interface LinkTeamContext {
  channelName: string;
  channelUrl: string;
  organizations: OrganizationSummary[];
}
