import {keepPreviousData, useQuery} from '@tanstack/react-query';
import {useQueryStates} from 'nuqs';

import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t, tn} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {pageFilterParsers} from 'sentry/utils/url/pageFilterParsers';
import {useOrganization} from 'sentry/utils/useOrganization';

type Counts = {
  counts: {
    active: number;
    disabled: number;
    total: number;
  };
};

export function MonitorsDropdown() {
  const organization = useOrganization();
  const [{project, environment}] = useQueryStates(pageFilterParsers);

  const {data: cronsData, isPending: cronsIsPending} = useQuery({
    ...apiOptions.as<Counts>()('/organizations/$organizationIdOrSlug/monitors-count/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {project, environment},
      staleTime: 0,
    }),
    placeholderData: keepPreviousData,
    retry: false,
  });

  const {data: uptimeData, isPending: uptimeIsPending} = useQuery({
    ...apiOptions.as<Counts>()('/organizations/$organizationIdOrSlug/uptime-count/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {project, environment},
      staleTime: 0,
    }),
    placeholderData: keepPreviousData,
    retry: false,
  });

  if (cronsIsPending || uptimeIsPending || !cronsData || !uptimeData) {
    return null;
  }

  return (
    <DropdownMenu
      items={[
        {
          key: 'crons',
          label: t('View Active Cron Monitors (%s)', cronsData.counts.active),
          to: `/organizations/${organization.slug}/insights/crons/`,
          details:
            cronsData.counts.disabled > 0
              ? tn(
                  '%s disabled monitor',
                  '%s disabled monitors',
                  cronsData.counts.disabled
                )
              : undefined,
        },
        {
          key: 'uptime',
          label: t('View Active Uptime Monitors (%s)', uptimeData.counts.active),
          to: `/organizations/${organization.slug}/insights/uptime/`,
          details:
            uptimeData.counts.disabled > 0
              ? tn(
                  '%s disabled monitor',
                  '%s disabled monitors',
                  uptimeData.counts.disabled
                )
              : undefined,
        },
      ]}
      trigger={(props, isOpen) => (
        <OverlayTrigger.Button size="sm" isOpen={isOpen} {...props}>
          {tn(
            '%s Monitor',
            '%s Monitors',
            cronsData.counts.total + uptimeData.counts.total
          )}
        </OverlayTrigger.Button>
      )}
    />
  );
}
