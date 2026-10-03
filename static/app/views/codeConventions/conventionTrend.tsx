import {useQuery} from '@tanstack/react-query';

import {MiniBarChart} from 'sentry/components/charts/miniBarChart';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import type {EventsStats} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {CONVENTIONS_PROJECT_ID} from 'sentry/views/codeConventions/utils';

const CHART_HEIGHT = 25;

interface Props {
  /**
   * The `[<name>]` prefix the convention's issue titles start with.
   */
  titlePrefix: string;
}

/**
 * Daily count of distinct violations reported for a convention. The scanner
 * reports every violation it still finds on each run, so a falling line means
 * violations are being fixed.
 */
export function ConventionTrend({titlePrefix}: Props) {
  const organization = useOrganization();

  const {data: series, isPending} = useQuery({
    ...apiOptions.as<EventsStats>()(
      '/organizations/$organizationIdOrSlug/events-stats/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: 'errors',
          interval: '1d',
          project: CONVENTIONS_PROJECT_ID,
          query: `title:"*${titlePrefix}*"`,
          statsPeriod: '30d',
          yAxis: 'count_unique(issue)',
          referrer: 'code-quality.convention-trend',
        },
        staleTime: 5 * 60 * 1000,
      }
    ),
    select: ({json}): Series[] => [
      {
        seriesName: t('Open violations'),
        data: json.data.map(([timestamp, counts]) => ({
          name: timestamp * 1000,
          value: counts.reduce((sum, {count}) => sum + count, 0),
        })),
      },
    ],
  });

  if (isPending) {
    return <Placeholder width="100%" height={`${CHART_HEIGHT}px`} />;
  }

  return (
    <MiniBarChart
      isGroupedByDate
      showTimeInTooltip
      series={series}
      height={CHART_HEIGHT}
    />
  );
}
