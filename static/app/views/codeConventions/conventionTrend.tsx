import {useQuery, useQueryClient} from '@tanstack/react-query';

import {Container} from '@sentry/scraps/layout';

import {MiniBarChart} from 'sentry/components/charts/miniBarChart';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import type {Group} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {CONVENTIONS_PROJECT_ID} from 'sentry/views/codeConventions/utils';

const CHART_HEIGHT = 25;
// The table clips its cells, so the tooltip has to render outside it.
const TOOLTIP_OPTIONS = {appendToBody: true};
const DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
// No API returns resolution times filtered by issue title, so they're read from
// each issue's activity. A sample keeps that to a few dozen requests per row.
const SAMPLE_SIZE = 25;
const CONCURRENCY = 4;

interface ResolvedSample {
  /**
   * When each sampled issue was last resolved.
   */
  resolvedAt: string[];
  sampled: number;
  total: number;
}

/**
 * Counts resolutions per UTC day over the last `days` days, scaled up by how
 * much of the total the sample covers.
 */
export function bucketResolutions(
  {resolvedAt, sampled, total}: ResolvedSample,
  now: number,
  days = DAYS
) {
  const todayStart = Math.floor(now / DAY_MS) * DAY_MS;
  const firstDayStart = todayStart - (days - 1) * DAY_MS;
  const counts = Array.from({length: days}, () => 0);
  for (const date of resolvedAt) {
    const index = Math.floor((Date.parse(date) - firstDayStart) / DAY_MS);
    if (index >= 0 && index < days) {
      counts[index]! += 1;
    }
  }
  const scale = sampled > 0 ? total / sampled : 1;
  return counts.map((count, index) => ({
    name: firstDayStart + index * DAY_MS,
    value: Math.round(count * scale),
  }));
}

interface Props {
  /**
   * The `[<name>]` prefix the convention's issue titles start with.
   */
  titlePrefix: string;
}

export function ConventionTrend({titlePrefix}: Props) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const {data: series, isPending} = useQuery({
    queryKey: ['convention-resolved-trend', organization.slug, titlePrefix],
    queryFn: async (): Promise<ResolvedSample> => {
      const issues = await queryClient.fetchQuery(
        apiOptions.as<Group[]>()('/organizations/$organizationIdOrSlug/issues/', {
          path: {organizationIdOrSlug: organization.slug},
          query: {
            project: CONVENTIONS_PROJECT_ID,
            query: `is:resolved title:"*${titlePrefix}*"`,
            statsPeriod: `${DAYS}d`,
            limit: SAMPLE_SIZE,
          },
          staleTime: 5 * 60 * 1000,
        })
      );

      const resolvedAt: string[] = [];
      const queue = [...issues.json];
      const worker = async () => {
        for (let issue = queue.shift(); issue; issue = queue.shift()) {
          const {json} = await queryClient.fetchQuery(
            apiOptions.as<{activity: Array<{dateCreated: string; type: string}>}>()(
              '/organizations/$organizationIdOrSlug/issues/$issueId/activities/',
              {
                path: {organizationIdOrSlug: organization.slug, issueId: issue.id},
                staleTime: 5 * 60 * 1000,
              }
            )
          );
          // Activity is newest first, so this is the resolution still in effect.
          const resolution = json.activity.find(item =>
            item.type.startsWith('set_resolved')
          );
          if (resolution) {
            resolvedAt.push(resolution.dateCreated);
          }
        }
      };
      await Promise.all(Array.from({length: CONCURRENCY}, worker));

      return {
        resolvedAt,
        sampled: issues.json.length,
        total: issues.headers['X-Hits'] ?? issues.json.length,
      };
    },
    select: (sample): Series[] => [
      {
        seriesName:
          sample.sampled < sample.total
            ? t('Resolved (estimated from %s issues)', sample.sampled)
            : t('Resolved'),
        data: bucketResolutions(sample, Date.now()),
      },
    ],
    staleTime: 5 * 60 * 1000,
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
