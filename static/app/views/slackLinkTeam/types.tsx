import type {OrganizationSummary, Team} from 'sentry/types/organization';

export type LinkTeamOrganization = Pick<
  OrganizationSummary,
  'id' | 'slug' | 'name' | 'links'
>;

export interface LinkTeamContext {
  channelName: string;
  channelUrl: string;
  organizations: LinkTeamOrganization[];
}

export type LinkResult =
  | {kind: 'linked'; team: Team}
  | {detail: string; kind: 'alreadyLinked'};
