import type {Organization} from 'sentry/types/organization';

export function hasOurlogsAlertsFeature(organization: Organization): boolean {
  return organization.features.includes('ourlogs-alerts');
}
