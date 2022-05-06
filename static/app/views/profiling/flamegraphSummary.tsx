import {Fragment, useMemo} from 'react';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import * as Layout from 'sentry/components/layouts/thirds';
import {Breadcrumb} from 'sentry/components/profiling/breadcrumb';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {Project} from 'sentry/types';
import {Trace} from 'sentry/types/profiling/core';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';
import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';
import {getSlowestProfileCallsFromProfileGroup} from 'sentry/utils/profiling/profile/utils';
import {makeFormatter} from 'sentry/utils/profiling/units/units';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import {useProfileGroup} from './profileGroupProvider';

type FlamegraphSummaryProps = {
  location: Location;
  params: {
    eventId?: Trace['id'];
    projectId?: Project['id'];
  };
};

function FlamegraphSummary(props: FlamegraphSummaryProps) {
  const location = useLocation();
  const [state] = useProfileGroup();
  const organization = useOrganization();

  const functions = useMemo(() => {
    if (state.type === 'resolved') {
      const {slowestApplicationCalls, slowestSystemCalls} =
        getSlowestProfileCallsFromProfileGroup(state.data);

      const asTableRow = (call: CallTreeNode): TableDataRow => {
        return {
          symbol: call.frame.name,
          image: call.frame.image,
          'self weight': call.selfWeight,
          'total weight': call.totalWeight,
        };
      };

      return {
        slowestApplicationCalls: slowestApplicationCalls.map(asTableRow),
        slowestSystemCalls: slowestSystemCalls.map(asTableRow),
      };
    }
    return {slowestApplicationCalls: [], slowestSystemCalls: []};
  }, [state]);

  return (
    <Fragment>
      <SentryDocumentTitle
        title={t('Profiling - Profile Functions')}
        orgSlug={organization.slug}
      />
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumb
            location={location}
            organization={organization}
            trails={[
              {type: 'landing'},
              {
                type: 'flamegraph',
                payload: {
                  transaction: state.type === 'resolved' ? state.data.name : '',
                  profileId: props.params.eventId ?? '',
                  projectSlug: props.params.projectId ?? '',
                },
              },
            ]}
          />
        </Layout.HeaderContent>
      </Layout.Header>
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

  switch (column.key) {
    case 'self weight':
      return <NumberContainer>{formatter(value)}</NumberContainer>;
    case 'total weight':
      return <NumberContainer>{formatter(value)}</NumberContainer>;
    case 'image':
      return <Container>{value ?? 'Unknown'}</Container>;
    default:
      return <Container>{value}</Container>;
  }
}

type TableColumnKey = 'symbol' | 'image' | 'self weight' | 'total weight';
type TableDataRow = Record<TableColumnKey, any>;

type TableColumn = GridColumnOrder<TableColumnKey>;

const COLUMN_ORDER: TableColumnKey[] = ['symbol', 'image', 'self weight', 'total weight'];

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
