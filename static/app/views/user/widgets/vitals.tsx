import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import LoadingError from 'sentry/components/loadingError';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import {WebVital} from 'sentry/utils/fields';
import {getDuration} from 'sentry/utils/formatters';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {VitalState} from 'sentry/views/performance/vitalDetail/utils';
import VitalPercents from 'sentry/views/performance/vitalDetail/vitalPercents';

import {UserParams} from '../types';

type Props = UserParams;

type Vital = {
  good: number;
  meh: number;
  p75: number;
  poor: number;
  total: number;
};

interface VitalsResponse {
  'measurements.cls': Vital;
  'measurements.fcp': Vital;
  'measurements.fid': Vital;
  'measurements.fp': Vital;
  'measurements.lcp': Vital;
  meta: Record<string, any>;
}

export function VitalsWidget({userKey, userValue}: Props) {
  const location = useLocation();
  const organization = useOrganization();

  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);
    conditions.addFilterValue('event.type', 'transaction');
    conditions.addFilterValue(`user.${userKey}`, userValue);

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: [
          'project_id',
          'last_seen()',
          'transaction',
          'failure_count()',
          'tpm()',
          'count_unique(user)',
          'p95(transaction.duration)',
          'count_miserable(user)',
          'user_misery()',
          'count()',
          'browser.name',
          'browser.version',
          'os.name',
          'os.version',
        ],
        projects: [],
        query: conditions.formatString(),
        orderby: decodeScalar(location.query.sort, '-p95_transaction_duration'),
      },
      location
    );
  }, [location, userKey, userValue]);

  const payload = eventView.getEventsAPIPayload(location);
  const results = useApiQuery<VitalsResponse>(
    [
      `/organizations/${organization.slug}/events-vitals/`,
      {
        query: {
          ...payload,
          vital: [
            'measurements.fp',
            'measurements.fcp',
            'measurements.lcp',
            'measurements.fid',
            'measurements.cls',
          ],
        },
      },
    ],
    {staleTime: 0, retry: false}
  );

  const {isLoading, error, data} = results;

  const measures: [string, WebVital][] = [
    ['First Paint (FP)', WebVital.FP],
    ['First Contentful Paint (FCP)', WebVital.FCP],
    ['Largest Contentful Paint (LCP)', WebVital.LCP],
    ['First Input Delay (FID)', WebVital.FID],
    ['Cumulative Layout Shift (CLS)', WebVital.CLS],
  ];

  return (
    <VitalsPanel>
      <PanelHeader>{t('Web Vitals')}</PanelHeader>
      {isLoading ? (
        <Placeholder height="189px" />
      ) : error ? (
        <LoadingError />
      ) : (
        <div>
          <Table>
            {measures.map(([measureName, vital]) => {
              const hasVital = data[vital].p75 !== null;

              return (
                <Fragment key={vital}>
                  <span>{measureName}</span>
                  <span>
                    {hasVital ? getDuration(data[vital].p75 / 1000, 2, true) : '—'}
                  </span>
                  {hasVital ? (
                    <VitalPercents
                      percents={[
                        {
                          vitalState: VitalState.POOR,
                          percent: data[vital].poor / data[vital].total,
                        },
                      ]}
                      vital={vital}
                    />
                  ) : (
                    <div />
                  )}
                  {hasVital ? (
                    <VitalPercents
                      percents={[
                        {
                          vitalState: VitalState.MEH,
                          percent: data[vital].meh / data[vital].total,
                        },
                      ]}
                      vital={vital}
                    />
                  ) : (
                    <div />
                  )}
                  {hasVital ? (
                    <VitalPercents
                      percents={[
                        {
                          vitalState: VitalState.GOOD,
                          percent: data[vital].good / data[vital].total,
                        },
                      ]}
                      vital={vital}
                    />
                  ) : (
                    <div />
                  )}
                </Fragment>
              );
            })}
          </Table>
        </div>
      )}
    </VitalsPanel>
  );
}

const Table = styled('div')`
  display: grid;
  overflow: hidden;
  gap: ${space(1.5)};
  grid-template-columns: auto max-content max-content max-content max-content;
  align-items: center;
  padding: ${space(1)} ${space(2)};
`;

const VitalsPanel = styled(Panel)`
  overflow: hidden;
`;
