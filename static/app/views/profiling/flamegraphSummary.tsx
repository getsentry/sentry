import {Fragment, useMemo} from 'react';
import {Link} from 'react-router';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';
import {getSlowestProfileCallsFromProfileGroup} from 'sentry/utils/profiling/profile/utils';
import {makeFormatter} from 'sentry/utils/profiling/units/units';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {useProfileGroup} from './profileGroupProvider';
import {generateFlamegraphRoute} from './routes';

function FlamegraphSummary() {
  const location = useLocation();
  const [state] = useProfileGroup();
  const organization = useOrganization();

  const functions = useMemo(() => {
    if (state.type === 'resolved') {
      const {slowestApplicationCalls, slowestSystemCalls} =
        getSlowestProfileCallsFromProfileGroup(state.data);

      let allSlowestApplicationCalls: TableDataRow[] = [];
      for (const threadID in slowestApplicationCalls) {
        allSlowestApplicationCalls = allSlowestApplicationCalls.concat(
          slowestApplicationCalls[threadID].map(call => {
            return {
              symbol: call.frame.name,
              image: call.frame.image,
              thread: threadID,
              'self weight': call.selfWeight,
              'total weight': call.totalWeight,
            };
          })
        );
      }

      let allSlowestSystemCalls: TableDataRow[] = [];
      for (const threadID in slowestSystemCalls) {
        allSlowestSystemCalls = allSlowestSystemCalls.concat(
          slowestSystemCalls[threadID].map(call => {
            return {
              symbol: call.frame.name,
              image: call.frame.image,
              thread: threadID,
              'self weight': call.selfWeight,
              'total weight': call.totalWeight,
            };
          })
        );
      }

      return {
        slowestApplicationCalls: allSlowestApplicationCalls
          .sort((a, b) => b['self weight'] - a['self weight'])
          .splice(0, 10),
        slowestSystemCalls: allSlowestSystemCalls
          .sort((a, b) => b['self weight'] - a['self weight'])
          .splice(0, 10),
      };
    }
    return {slowestApplicationCalls: [], slowestSystemCalls: []};
  }, [state]);

  return (
    <Fragment>
      <SentryDocumentTitle
        title={t('Profiling \u2014 Function')}
        orgSlug={organization.slug}
      >
        <Layout.Body>
          <Layout.Main fullWidth>
            <GridEditable
              title={t('Slowest Application Calls')}
              isLoading={state.type === 'loading'}
              error={state.type === 'errored'}
              data={functions.slowestApplicationCalls}
              columnOrder={COLUMN_ORDER.map(key => COLUMNS[key])}
              columnSortBy={[]}
              grid={{renderBodyCell: renderFunctionCell}}
              location={location}
            />
            <GridEditable
              title={t('Slowest System Calls')}
              isLoading={state.type === 'loading'}
              error={state.type === 'errored'}
              data={functions.slowestSystemCalls}
              columnOrder={COLUMN_ORDER.map(key => COLUMNS[key])}
              columnSortBy={[]}
              grid={{renderBodyCell: renderFunctionCell}}
              location={location}
            />
          </Layout.Main>
        </Layout.Body>
      </SentryDocumentTitle>
    </Fragment>
  );
}

function renderFunctionCell(
  column: TableColumn,
  dataRow: TableDataRow,
  rowIndex: number,
  columnIndex: number
) {
  return (
    <ProfilingFunctionsTableCell
      column={column}
      dataRow={dataRow}
      rowIndex={rowIndex}
      columnIndex={columnIndex}
    />
  );
}

interface ProfilingFunctionsTableCellProps {
  column: TableColumn;
  columnIndex: number;
  dataRow: TableDataRow;
  rowIndex: number;
}

const formatter = makeFormatter('nanoseconds');
function ProfilingFunctionsTableCell({
  column,
  dataRow,
}: ProfilingFunctionsTableCellProps) {
  const value = dataRow[column.key];
  const {orgId, projectId, eventId} = useParams();

  switch (column.key) {
    case 'self weight':
      return <NumberContainer>{formatter(value)}</NumberContainer>;
    case 'total weight':
      return <NumberContainer>{formatter(value)}</NumberContainer>;
    case 'image':
      return <Container>{value ?? 'Unknown'}</Container>;
    case 'thread': {
      return (
        <Container>
          <Link
            to={
              generateFlamegraphRoute({
                orgSlug: orgId,
                projectSlug: projectId,
                profileId: eventId,
              }) + `?tid=${dataRow.thread}`
            }
          >
            {value}
          </Link>
        </Container>
      );
    }
    default:
      return <Container>{value}</Container>;
  }
}

type TableColumnKey = 'symbol' | 'image' | 'self weight' | 'total weight' | 'thread';
type TableDataRow = Record<TableColumnKey, any>;

type TableColumn = GridColumnOrder<TableColumnKey>;

const COLUMN_ORDER: TableColumnKey[] = [
  'symbol',
  'image',
  'thread',
  'self weight',
  'total weight',
];

// TODO: looks like these column names change depending on the platform?
const COLUMNS: Record<TableColumnKey, TableColumn> = {
  symbol: {
    key: 'symbol',
    name: t('Symbol'),
    width: COL_WIDTH_UNDEFINED,
  },
  image: {
    key: 'image',
    name: t('Binary'),
    width: COL_WIDTH_UNDEFINED,
  },
  thread: {
    key: 'thread',
    name: t('Thread'),
    width: COL_WIDTH_UNDEFINED,
  },
  'self weight': {
    key: 'self weight',
    name: t('Self Weight'),
    width: COL_WIDTH_UNDEFINED,
  },
  'total weight': {
    key: 'total weight',
    name: t('Total Weight'),
    width: COL_WIDTH_UNDEFINED,
  },
};

export default FlamegraphSummary;
