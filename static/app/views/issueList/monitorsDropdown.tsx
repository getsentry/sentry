import {DropdownButton} from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {t, tn} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {keepPreviousData, useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
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
  const location = useLocation();

  const {data: cronsData, isPending: cronsIsPending} = useApiQuery<Counts>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/monitors-count/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          project: location.query.project,
          environment: location.query.environment,
        },
      },
    ],
    {
      staleTime: 0,
      placeholderData: keepPreviousData,
      retry: false,
    }
  );

  const {data: uptimeData, isPending: uptimeIsPending} = useApiQuery<Counts>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/uptime-count/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          project: location.query.project,
          environment: location.query.environment,
        },
      },
    ],
    {
      staleTime: 0,
      placeholderData: keepPreviousData,
      retry: false,
    }
  );

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
        <DropdownButton size="sm" isOpen={isOpen} {...props}>
          {tn(
            '%s Monitor',
            '%s Monitors',
            cronsData.counts.total + uptimeData.counts.total
          )}
        </DropdownButton>
      )}
    />
  );
}
