import {hasEveryAccess} from 'sentry/components/acl/access';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

// Whether places outside project settings, like the issue actions, offer to add a
// custom inbound filter. `inbound-filters-v2` and `inbound-filters-v2-ui` also gate
// the filters table in project settings. `inbound-filters-in-product-flows` gates
// the places outside of it.
export function offersInProductFilters(organization: Organization): boolean {
  return (
    organization.features.includes('inbound-filters-v2') &&
    organization.features.includes('inbound-filters-v2-ui') &&
    organization.features.includes('inbound-filters-in-product-flows')
  );
}

// Why the user cannot add a custom inbound filter to the project, or undefined when
// they can. The API refuses the write in both cases, so a place that offers the
// filter says so up front instead of letting the modal fail on save.
export function getFilterWriteDisabledReason(
  organization: Organization,
  project: Project
): string | undefined {
  if (!project.features.includes('custom-inbound-filters')) {
    return t('Your plan does not include custom inbound filters');
  }
  if (!hasEveryAccess(['project:write'], {organization, project})) {
    return t('You need project write access to add custom inbound filters');
  }
  return undefined;
}
