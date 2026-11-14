import type {OrganizationSummary} from 'sentry/types/organization';

export type LinkTeamOrganization = Pick<
  OrganizationSummary,
  'id' | 'slug' | 'name' | 'links'
>;

export interface LinkTeamContext {
  channelName: string;
  channelUrl: string;
  organizations: LinkTeamOrganization[];
}
