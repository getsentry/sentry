import type {Organization} from 'sentry/types/organization';

const AUTOFIX_PAGE_FEATURE = 'autofix-page';

export function hasAutofixPage(organization: Organization) {
  return organization.features.includes(AUTOFIX_PAGE_FEATURE);
}
