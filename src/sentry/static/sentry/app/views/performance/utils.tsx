import {Organization} from 'app/types';

export function getPerformanceLandingUrl(organization: Organization): string {
  return `/organizations/${organization.slug}/performance/`;
}
