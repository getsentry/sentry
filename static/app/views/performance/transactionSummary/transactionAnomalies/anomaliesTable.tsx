import {ReactNode} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Count from 'sentry/components/count';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {ColumnType, fieldAlignment} from 'sentry/utils/discover/fields';
import {AnomalyInfo} from 'sentry/utils/performance/anomalies/anomaliesQuery';

type Props = {
  isLoading: boolean;
  location: Location;
  organization: Organization;
  anomalies?: AnomalyInfo[];
};

const transformRow = (anom: AnomalyInfo): TableDataRowWithExtras => {
  return {
    anomaly: `#${anom.id}`,
    confidence: anom.confidence,
    timestamp: new Date(anom.start),
    timeInterval: anom.end - anom.start,
    expected: anom.expected,
    received: anom.received,
  };
};

export default function AnomaliesTable(props: Props) {
  const {location, organization, isLoading, anomalies} = props;

  const data: TableDataRowWithExtras[] = anomalies?.map(transformRow) || [];

  return (
    <GridEditable
      isLoading={isLoading}
      data={data}
      columnOrder={Object.values(COLUMNS)}
      columnSortBy={[]}
      grid={{
        renderHeadCell,
        renderBodyCell: renderBodyCellWithMeta(location, organization),
      }}
      location={location}
    />
  );
}

function renderHeadCell(column: TableColumn, _index: number): ReactNode {
  const align = fieldAlignment(column.key, COLUMN_TYPE[column.key]);
  return (
    <SortLink
      title={column.name}
      align={align}
      direction={undefined}
      canSort={false}
      generateSortLink={() => undefined}
    />
  );
}

function renderBodyCellWithMeta(location: Location, organization: Organization) {
  return (column: TableColumn, dataRow: TableDataRowWithExtras): React.ReactNode => {
    const fieldRenderer = getFieldRenderer(column.key, COLUMN_TYPE);

    if (column.key === 'confidence') {
      return (
        <ConfidenceCell>
          {dataRow.confidence === 'low' ? (
            <LowConfidence>{t('Low Confidence')}</LowConfidence>
          ) : (
            <HighConfidence>{t('High Confidence')}</HighConfidence>
          )}
        </ConfidenceCell>
      );
    }
    if (column.key === 'expected') {
      return (
        <NumberCell>
          <Count value={dataRow.expected} />
        </NumberCell>
      );
    }
    if (column.key === 'received') {
      return (
        <NumberCell>
          <Count value={dataRow.received} />
          <IconArrow
            size="sm"
            direction={dataRow.received > dataRow.expected ? 'up' : 'down'}
          />
        </NumberCell>
      );
    }

    return fieldRenderer(dataRow, {location, organization});
  };
}

const NumberCell = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: ${space(0.5)};
`;

const LowConfidence = styled('div')`
  color: ${p => p.theme.yellow300};
`;
const HighConfidence = styled('div')`
  color: ${p => p.theme.red300};
`;

const ConfidenceCell = styled('div')`
  text-align: left;
  justify-self: flex-end;
  flex-grow: 1;
`;

type TableColumnKey =
  | 'anomaly'
  | 'confidence'
  | 'timeInterval'
  | 'timestamp'
  | 'expected'
  | 'received';

type TableColumn = GridColumnOrder<TableColumnKey>;

type TableDataRow = Record<TableColumnKey, any>;

type TableDataRowWithExtras = TableDataRow & {};

const COLUMNS: Record<TableColumnKey, TableColumn> = {
  anomaly: {
    key: 'anomaly',
    name: t('Anomaly'),
    width: COL_WIDTH_UNDEFINED,
  },
  confidence: {
    key: 'confidence',
    name: t('Confidence'),
    width: COL_WIDTH_UNDEFINED,
  },
  timeInterval: {
    key: 'timeInterval',
    name: t('Time Interval'),
    width: COL_WIDTH_UNDEFINED,
  },
  timestamp: {
    key: 'timestamp',
    name: t('Timestamp'),
    width: COL_WIDTH_UNDEFINED,
  },
  expected: {
    key: 'expected',
    name: t('Expected'),
    width: COL_WIDTH_UNDEFINED,
  },
  received: {
    key: 'received',
    name: t('Received'),
    width: COL_WIDTH_UNDEFINED,
  },
};

const COLUMN_TYPE: Record<TableColumnKey, ColumnType> = {
  anomaly: 'string',
  confidence: 'string',
  timeInterval: 'duration',
  timestamp: 'date',
  expected: 'number',
  received: 'number',
};
