import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {MiniBarChart} from 'sentry/components/charts/miniBarChart';
import {EmptyMessage} from 'sentry/components/emptyMessage';
import {LoadingError} from 'sentry/components/loadingError';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

type KeyStatPoint = {
  accepted: number;
  dropped: number;
  total: number;
  ts: number;
};

type DerivedStats = {
  emptyStats: boolean;
  series: Series[];
};

function deriveStats(data: KeyStatPoint[]): DerivedStats {
  let emptyStats = true;
  const dropped: Series['data'] = [];
  const accepted: Series['data'] = [];

  data.forEach(p => {
    if (p.total) {
      emptyStats = false;
    }
    dropped.push({name: p.ts * 1000, value: p.dropped});
    accepted.push({name: p.ts * 1000, value: p.accepted});
  });

  const series: Series[] = [
    {
      seriesName: t('Accepted'),
      data: accepted,
    },
    {
      seriesName: t('Rate Limited'),
      data: dropped,
    },
  ];

  return {series, emptyStats};
}

export function KeyStats() {
  const organization = useOrganization();
  const theme = useTheme();
  const {keyId, projectId} = useParams<{keyId: string; projectId: string}>();

  const queryBase = useMemo(() => {
    const until = Math.floor(Date.now() / 1000);
    return {
      since: until - 3600 * 24 * 30,
      until,
    };
  }, []);

  const {data, isPending, isError, refetch} = useApiQuery<KeyStatPoint[]>(
    [
      getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/keys/$keyId/stats/', {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: projectId,
          keyId,
        },
      }),
      {query: {...queryBase, resolution: '1d'}},
    ],
    {staleTime: 0}
  );

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const {series, emptyStats} = data ? deriveStats(data) : {series: [], emptyStats: true};

  return (
    <Panel>
      <PanelHeader>{t('Key usage in the last 30 days (by day)')}</PanelHeader>
      <PanelBody withPadding>
        {isPending ? (
          <Placeholder height="150px" />
        ) : emptyStats ? (
          <EmptyMessage title={t('Nothing recorded in the last 30 days.')}>
            {t('Total events captured using these credentials.')}
          </EmptyMessage>
        ) : (
          <MiniBarChart
            isGroupedByDate
            series={series}
            height={150}
            colors={[theme.colors.gray200, theme.colors.red400]}
            stacked
            labelYAxisExtents
          />
        )}
      </PanelBody>
    </Panel>
  );
}
