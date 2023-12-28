import {useState} from 'react';
import styled from '@emotion/styled';
import shuffle from 'lodash/shuffle';

import Badge from 'sentry/components/badge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PanelTableHeader} from 'sentry/components/panels/panelTable';
import {space} from 'sentry/styles/space';
import {MRI} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {useMetricsSpans} from 'sentry/utils/metrics/useMetricsCodeLocations';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  generateProfileLink,
  generateReplayLink,
  generateTraceLink,
  generateTransactionLink,
} from 'sentry/views/performance/transactionSummary/utils';

import TransactionsTable from '../../components/discover/transactionsTable';
import {MetricRange} from '../../utils/metrics/index';

export type SamplesTableProps = MetricRange & {
  mri: MRI;
};

// TODO(ddm): This is a placeholder component. Shown data is bogus.
export function TraceTable({mri, ...range}: SamplesTableProps) {
  const location = useLocation();
  const organization = useOrganization();

  const eventView = EventView.fromLocation(location);

  const {isLoading} = useMetricsSpans(mri, range);

  const tableData: any = {
    data: [
      {
        'profile.id': null,
        timestamp: '2023-10-30T07:04:57+00:00',
        'spans.ui': 4817.500354,
        'span_ops_breakdown.relative': '',
        replayId: '2a3ef28213b2f408ca2828b6a27149c2b',
        'transaction.duration': 11893,
        'spans.db': null,
        trace: '9fe2707d6a4dc45efa75439764f963188a',
        'spans.http': 8814.999819,
        'spans.resource': 2655.700206,
        id: 'ddb209c68a54846b19e3422309afb26ca3',
        'user.display': 'alexandra.cota@sentry.io',
        'spans.browser': 637.500286,
        'project.name': 'javascript',
      },
      {
        'profile.id': '2a3ef28213b2f408ca2828b6a27149c2b',
        timestamp: '2023-10-29T22:17:08+00:00',
        'spans.ui': 19985.199929,
        'span_ops_breakdown.relative': '',
        replayId: '',
        'transaction.duration': 11888,
        'spans.db': null,
        trace: '343267d658554f44be28a42e49f460f3',
        'spans.http': 9248.399973,
        'spans.resource': 1555.999995,
        id: 'e77387c5a7e043312aaaf7f406c6049a2',
        'user.display': 'matej.minar@sentry.io',
        'spans.browser': 534.999848,
        'project.name': 'javascript',
      },
      {
        'profile.id': null,
        timestamp: '2023-10-30T01:45:19+00:00',
        'spans.ui': 5709.600449,
        'span_ops_breakdown.relative': '',
        replayId: '',
        'transaction.duration': 11863,
        'spans.db': null,
        trace: '9ad958c8af21d4c0db58bb5542c41c4d13',
        'spans.http': 9214.499951,
        'spans.resource': 2082.90124,
        id: 'acc1854b13a04f84bd2f0fc5b803dd65',
        'user.display': 'riccardo.busetti@sentry.io',
        'spans.browser': 3389.699936,
        'project.name': 'javascript',
      },
      {
        'profile.id': '2a3ef28213b2f408ca2828b6a27149c2b',
        timestamp: '2023-10-29T16:59:16+00:00',
        'spans.ui': 2638.000251,
        'span_ops_breakdown.relative': '',
        replayId: '',
        'transaction.duration': 11857,
        'spans.db': null,
        trace: '548f0e7a4bd44a28aee52b890698440e',
        'spans.http': 10524.60003,
        'spans.resource': 222.597839,
        id: 'e491bd2be0734357ab9dcc690133a43b',
        'user.display': 'ognjen.bostjancic@sentry.io',
        'spans.browser': 9877.500056,
        'project.name': 'javascript',
      },
      {
        'profile.id': null,
        timestamp: '2023-10-30T11:39:40+00:00',
        'spans.ui': 2214.000223,
        'span_ops_breakdown.relative': '',
        replayId: '2a3ef28213b2f408ca2828b6a27149c2b',
        'transaction.duration': 11852,
        'spans.db': null,
        trace: 'eaad797b3c2c34b79bb705e5af2db688b',
        'spans.http': 4308.000088,
        'spans.resource': 16362.000228,
        id: 'd53b10ef8edc43023b92caf8d0a8a473d',
        'user.display': 'arhur.knaus@sentry.io',
        'spans.browser': 615.000009,
        'project.name': 'javascript',
      },
    ],
    meta: {
      'profile.id': 'string',
      timestamp: 'date',
      'spans.ui': 'duration',
      'span_ops_breakdown.relative': 'string',
      replayId: 'string',
      'transaction.duration': 'duration',
      'spans.db': 'duration',
      trace: 'string',
      'spans.http': 'duration',
      'spans.resource': 'duration',
      id: 'string',
      'user.display': 'string',
      'spans.browser': 'duration',
      'project.name': 'string',
      units: {
        'profile.id': null,
        timestamp: null,
        'spans.ui': 'millisecond',
        'span_ops_breakdown.relative': null,
        replayId: null,
        'transaction.duration': 'millisecond',
        'spans.db': 'millisecond',
        trace: null,
        'spans.http': 'millisecond',
        'spans.resource': 'millisecond',
        id: null,
        'user.display': null,
        'spans.browser': 'millisecond',
        'project.name': null,
      },
      isMetricsData: false,
      tips: {
        query: null,
        columns: null,
      },
      datasetReason: 'unchanged',
      dataset: 'discover',
    },
  };

  const [rows] = useState(() => shuffle(tableData.data));

  const columnOrder: any = [
    {
      key: 'id',
      name: 'id',
      type: 'string',
      isSortable: false,
      column: {
        kind: 'field',
        field: 'id',
      },
      width: -1,
    },
    {
      key: 'user.display',
      name: 'user.display',
      type: 'string',
      isSortable: false,
      column: {
        kind: 'field',
        field: 'user.display',
      },
      width: -1,
    },
    {
      key: 'span_ops_breakdown.relative',
      name: 'span_ops_breakdown.relative',
      type: 'never',
      isSortable: false,
      column: {
        kind: 'field',
        field: 'span_ops_breakdown.relative',
      },
      width: -1,
    },
    {
      key: 'transaction.duration',
      name: 'transaction.duration',
      type: 'duration',
      isSortable: false,
      column: {
        kind: 'field',
        field: 'transaction.duration',
      },
      width: -1,
    },
    {
      key: 'trace',
      name: 'trace',
      type: 'string',
      isSortable: false,
      column: {
        kind: 'field',
        field: 'trace',
      },
      width: -1,
    },
    {
      key: 'timestamp',
      name: 'timestamp',
      type: 'date',
      isSortable: false,
      column: {
        kind: 'field',
        field: 'timestamp',
      },
      width: -1,
    },
    {
      key: 'replayId',
      name: 'replayId',
      type: 'string',
      isSortable: false,
      column: {
        kind: 'field',
        field: 'replayId',
      },
      width: -1,
    },
    {
      key: 'profile.id',
      name: 'profile.id',
      type: 'string',
      isSortable: false,
      column: {
        kind: 'field',
        field: 'profile.id',
      },
      width: -1,
    },
    {
      key: 'spans.browser',
      name: 'spans.browser',
      type: 'duration',
      isSortable: false,
      column: {
        kind: 'field',
        field: 'spans.browser',
      },
      width: -1,
    },
    {
      key: 'spans.db',
      name: 'spans.db',
      type: 'duration',
      isSortable: false,
      column: {
        kind: 'field',
        field: 'spans.db',
      },
      width: -1,
    },
    {
      key: 'spans.http',
      name: 'spans.http',
      type: 'duration',
      isSortable: false,
      column: {
        kind: 'field',
        field: 'spans.http',
      },
      width: -1,
    },
    {
      key: 'spans.resource',
      name: 'spans.resource',
      type: 'duration',
      isSortable: false,
      column: {
        kind: 'field',
        field: 'spans.resource',
      },
      width: -1,
    },
    {
      key: 'spans.ui',
      name: 'spans.ui',
      type: 'duration',
      isSortable: false,
      column: {
        kind: 'field',
        field: 'spans.ui',
      },
      width: -1,
    },
  ];

  if (isLoading) {
    return <LoadingIndicator />;
  }

  return (
    <TraceTableWrapper>
      <TitleOverlay>
        <StyledBadge type="alpha" color="white">
          Coming Soon
        </StyledBadge>
        <div>Sampled traces</div>
      </TitleOverlay>
      <TransactionsTable
        eventView={eventView}
        organization={organization}
        location={location}
        isLoading={false}
        tableData={{meta: tableData.meta, data: rows}}
        columnOrder={columnOrder}
        titles={[
          'event id',
          'user',
          'operation duration',
          'total duration',
          'trace id',
          'timestamp',
          'replay',
          'profile',
        ]}
        generateLink={{
          id: generateTransactionLink(''),
          trace: generateTraceLink(eventView.normalizeDateSelection(location)),
          replayId: generateReplayLink([]),
          'profile.id': generateProfileLink(),
        }}
        useAggregateAlias
      />
    </TraceTableWrapper>
  );
}

const TitleOverlay = styled('span')`
  position: absolute;

  display: flex;
  gap: ${space(1)};
  align-items: center;
  z-index: 1;

  line-height: 1.1;
  height: 46px;
  max-width: 250px;
  padding: 0px 16px;
  background-color: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.subText};
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  user-select: none;

  border-top: 1px solid ${p => p.theme.border};
  border-bottom: 1px solid ${p => p.theme.border};
  border-left: 1px solid ${p => p.theme.border};

  border-top-left-radius: 4px;
`;

const StyledBadge = styled(Badge)`
  color: white !important;
  margin-top: -1px;
`;

const TraceTableWrapper = styled('div')`
  pointer-events: none;

  width: 100%;
  user-select: none;

  > div {
    width: 100%;
  }

  > div > div > div {
    filter: blur(3px);
  }

  > div > ${PanelTableHeader} {
    color: ${p => p.theme.backgroundSecondary};

    span {
      display: none;
    }
  }

  > span > div {
    pointer-events: none;
  }
`;
