import {useMemo} from 'react';

import OrganizationBadge from 'sentry/components/idBadge/organizationBadge';
import {t} from 'sentry/locale';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {resolveRoute} from 'sentry/utils/resolveRoute';
import useOrganization from 'sentry/utils/useOrganization';

import type {OmniAction} from './types';

/**
 * Hook that provides all organizations as OmniActions for the OmniSearch palette.
 * No filtering is done here - palette.tsx handles the search.
 *
 * @returns Array of all available organization actions
 */
export function useOrganizationsDynamicActions(): OmniAction[] {
  const {organizations} = useLegacyStore(OrganizationsStore);
  const organization = useOrganization();

  const dynamicActions = useMemo<OmniAction[]>(() => {
    return organizations.map((org, index) => ({
      key: `org-${index}`,
      areaKey: 'navigate',
      label: org.name,
      details: t('Switch to the %s organization', org.slug),
      section: 'Organizations',
      actionIcon: <OrganizationBadge organization={org} hideName avatarSize={16} />,
      onAction: () => {
        window.location.href = resolveRoute(
          `/organizations/${org.slug}/issues/`,
          organization,
          org
        );
      },
    }));
  }, [organizations, organization]);

  return dynamicActions;
}
