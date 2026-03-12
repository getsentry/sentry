import {useCallback, useEffect, useMemo, useState} from 'react';
import type {Theme} from '@emotion/react';

import type {Client} from 'sentry/api';
import {MiniBarChart} from 'sentry/components/charts/miniBarChart';
import {EmptyMessage} from 'sentry/components/emptyMessage';
import {LoadingError} from 'sentry/components/loadingError';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';

type Props = {
  api: Client;
  organization: Organization;
  theme: Theme;
} & Pick<
  RouteComponentProps<{
    keyId: string;
    projectId: string;
  }>,
  'params'
>;

type State = StateLoading | StateError | StateSuccess;

type StateError = {
  status: 'error';
};

type StateLoading = {
  status: 'loading';
};

type StateSuccess = {
  emptyStats: boolean;
  series: Series[];
  since: number;
  status: 'success';
  until: number;
};

export function KeyStats({api, organization, params, theme}: Props) {
  const {keyId, projectId} = params;
  const queryBase = useMemo(() => {
    const until = Math.floor(Date.now() / 1000);
    return {
      since: until - 3600 * 24 * 30,
      until,
    };
  }, []);
  const [state, setState] = useState<State>({
    status: 'loading',
  });

  const fetchData = useCallback(() => {
    if (state.status !== 'loading') {
      return;
    }

    api.request(`/projects/${organization.slug}/${projectId}/keys/${keyId}/stats/`, {
      query: {
        ...queryBase,
        resolution: '1d',
      },
      success: data => {
        let emptyStats = true;
        const dropped: Series['data'] = [];
        const accepted: Series['data'] = [];
        data.forEach((p: any) => {
          if (p.total) {
            emptyStats = false;
          }
          dropped.push({name: p.ts * 1000, value: p.dropped});
          accepted.push({name: p.ts * 1000, value: p.accepted});
        });
        const series = [
          {
            seriesName: t('Accepted'),
            data: accepted,
          },
          {
            seriesName: t('Rate Limited'),
            data: dropped,
          },
        ];
        setState({
          ...queryBase,
          series,
          emptyStats,
          status: 'success',
        });
      },
      error: () => {
        setState({status: 'error'});
      },
    });
  }, [api, keyId, organization.slug, projectId, queryBase, state.status]);

  const retry = useCallback(() => {
    setState({status: 'loading'});
  }, []);

  useEffect(fetchData, [fetchData]);

  if (state.status === 'error') {
    return <LoadingError onRetry={retry} />;
  }

  return (
    <Panel>
      <PanelHeader>{t('Key usage in the last 30 days (by day)')}</PanelHeader>
      <PanelBody withPadding>
        {state.status === 'loading' ? (
          <Placeholder height="150px" />
        ) : state.emptyStats ? (
          <EmptyMessage title={t('Nothing recorded in the last 30 days.')}>
            {t('Total events captured using these credentials.')}
          </EmptyMessage>
        ) : (
          <MiniBarChart
            isGroupedByDate
            series={state.series}
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
