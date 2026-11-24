import {hasEveryAccess} from 'sentry/components/acl/access';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

type AddInboundFilterAvailability = {
  // Why the "Add inbound filter" action is disabled, shown next to it.
  disabledReason: string | undefined;
  isVisible: boolean;
};

// Gating shared by the places outside project settings that open the custom
// filter modal, like the issue and release actions menus.
//
// `inbound-filters-v2` and `inbound-filters-v2-ui` also gate the filters table
// in project settings. `inbound-filters-in-product-flows` gates the entry points
// outside it.
export function getAddInboundFilterAvailability(
  organization: Organization,
  project: Project
): AddInboundFilterAvailability {
  const isVisible =
    organization.features.includes('inbound-filters-v2') &&
    organization.features.includes('inbound-filters-v2-ui') &&
    organization.features.includes('inbound-filters-in-product-flows');

  // The API refuses writes without the plan feature or write access, so say so
  // up front instead of letting the modal fail on save.
  let disabledReason: string | undefined;
  if (!project.features.includes('custom-inbound-filters')) {
    disabledReason = t('Your plan does not include custom inbound filters');
  } else if (!hasEveryAccess(['project:write'], {organization, project})) {
    disabledReason = t('You need project write access to add custom inbound filters');
  }

  return {isVisible, disabledReason};
}
