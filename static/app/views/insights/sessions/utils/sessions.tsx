import type {SessionApiResponse} from 'sentry/types/organization';

export const getStatusSeries = (status: string, groups: SessionApiResponse['groups']) =>
  groups.find(group => group.by['session.status'] === status)?.series['sum(session)'] ??
  [];
