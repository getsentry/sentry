import {useTheme} from '@emotion/react';
import moment from 'moment-timezone';

import MarkLine from 'sentry/components/charts/components/markLine';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {getFormattedDate} from 'sentry/utils/dates';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  hydrateToFlagSeries,
  type RawFlagData,
} from 'sentry/views/issueDetails/streamline/featureFlagUtils';
import useSuspectFlags from 'sentry/views/issueDetails/streamline/useSuspectFlags';

interface FlagSeriesProps {
  event: Event | undefined;
  group: Group;
  query: Record<string, any>;
}

function useOrganizationFlagLog({
  organization,
  query,
}: {
  organization: Organization;
  query: Record<string, any>;
}) {
  return useApiQuery<RawFlagData>(
    [`/organizations/${organization.slug}/flags/logs/`, {query}],
    {
      staleTime: 0,
      enabled: organization.features?.includes('feature-flag-ui'),
    }
  );
}

export default function useFlagSeries({query = {}, event, group}: FlagSeriesProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const {
    data: rawFlagData,
    isError,
    isPending,
  } = useOrganizationFlagLog({organization, query});
  const {selection} = usePageFilters();

  useSuspectFlags({
    organization,
    query,
    firstSeen: group.firstSeen,
    rawFlagData,
    event,
  });

  if (!rawFlagData || isError || isPending) {
    return {
      seriesName: t('Feature Flags'),
      markLine: {},
      data: [],
    };
  }

  const hydratedFlagData = hydrateToFlagSeries(rawFlagData);

  // create a markline series using hydrated flag data
  const markLine = MarkLine({
    animation: false,
    lineStyle: {
      color: theme.blue300,
      opacity: 0.3,
      type: 'solid',
    },
    label: {
      show: false,
    },
    data: hydratedFlagData,
    tooltip: {
      trigger: 'item',
      formatter: ({data}: any) => {
        const time = getFormattedDate(data.xAxis, 'MMM D, YYYY LT z', {
          local: !selection.datetime.utc,
        });
        return [
          '<div class="tooltip-series">',
          `<div><span class="tooltip-label"><strong>${t(
            'Feature Flag'
          )}</strong></span></div>`,
          `<span class="tooltip-label-align-start"><code class="tooltip-code-no-margin">${data.name}</code>${data.label.formatter()}</span>`,
          '</div>',
          '<div class="tooltip-footer">',
          time,
          event?.dateCreated &&
            ` (${moment(time).from(event.dateCreated, true)} ${t('before this event')})`,
          '</div>',
          '<div class="tooltip-arrow"></div>',
        ].join('');
      },
    },
  });

  return {
    seriesName: t('Feature Flags'),
    data: [],
    color: theme.blue200,
    markLine,
    type: 'line', // use this type so the bar chart doesn't shrink/grow
  };
}
