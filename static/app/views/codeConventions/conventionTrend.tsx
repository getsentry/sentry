import {useQuery} from '@tanstack/react-query';

import {Container} from '@sentry/scraps/layout';

import {MiniBarChart} from 'sentry/components/charts/miniBarChart';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import type {EventsStats} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {CONVENTIONS_PROJECT_ID} from 'sentry/views/codeConventions/utils';

const CHART_HEIGHT = 25;
// The table clips its cells, so the tooltip has to render outside it.
const TOOLTIP_OPTIONS = {appendToBody: true};

interface Props {
  /**
   * The `[<name>]` prefix the convention's issue titles start with.
   */
  titlePrefix: string;
}

/**
 * How many of a convention's issues were known on each day: the distinct
 * issues reported that day. The scanner re-reports every violation it still
 * finds on each run, so falling bars mean violations are being fixed. Issue
 * resolutions aren't used because most are auto-resolves that the next scan
 * reopens.
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
        seriesName: t('Known issues'),
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

  // Table cells are flex containers, where the chart's own wrapper would
  // collapse to zero width before echarts measures it.
  return (
    <Container width="100%">
      <MiniBarChart
        isGroupedByDate
        showTimeInTooltip
        series={series}
        height={CHART_HEIGHT}
        tooltip={TOOLTIP_OPTIONS}
      />
    </Container>
  );
}
