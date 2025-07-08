import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconArrow} from 'sentry/icons';
import {tn} from 'sentry/locale';
import {keepPreviousData, useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

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
      `/organizations/${organization.slug}/monitors-count/`,
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
      `/organizations/${organization.slug}/uptime-count/`,
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
          label: tn(
            '%s Active Cron Monitor',
            '%s Active Cron Monitors',
            cronsData?.counts.active
          ),
          to: `/organizations/${organization.slug}/insights/crons/`,
          details:
            cronsData?.counts.disabled > 0
              ? tn(
                  '%s disabled monitor',
                  '%s disabled monitors',
                  cronsData?.counts.disabled
                )
              : undefined,
          trailingItems: <IconArrow direction="right" />,
        },
        {
          key: 'uptime',
          label: tn(
            '%s Active Uptime Monitor',
            '%s Active Uptime Monitors',
            uptimeData?.counts.active
          ),
          to: `/organizations/${organization.slug}/insights/uptime/`,
          details:
            uptimeData?.counts.disabled > 0
              ? tn(
                  '%s disabled monitor',
                  '%s disabled monitors',
                  uptimeData?.counts.disabled
                )
              : undefined,
          trailingItems: <IconArrow direction="right" />,
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
