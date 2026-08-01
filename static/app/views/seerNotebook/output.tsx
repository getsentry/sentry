import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {AreaChart} from 'sentry/components/charts/areaChart';
import {BarChart} from 'sentry/components/charts/barChart';
import {LineChart} from 'sentry/components/charts/lineChart';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';

import type {InvestigationCell} from './types';

type TableOutput = {
  columns: string[];
  rows: unknown[][];
};

export function getOutputColumns(output: unknown): string[] {
  return isTableOutput(output) ? output.columns : [];
}

export function PersistedCellOutput({cell}: {cell: InvestigationCell}) {
  if (cell.outputStatus === 'notRun') {
    return null;
  }
  if (cell.outputStatus === 'restricted') {
    return (
      <OutputMessage>
        {t('This result uses project data you do not have permission to view.')}
      </OutputMessage>
    );
  }
  if (cell.outputStatus === 'failed') {
    return <OutputMessage>{t('The persisted cell execution failed.')}</OutputMessage>;
  }
  if (cell.outputStatus !== 'available') {
    return <OutputMessage>{t('Result status: %s', cell.outputStatus)}</OutputMessage>;
  }
  if (!isTableOutput(cell.output)) {
    return (
      <RawOutput>
        <Text size="sm" bold>
          {t('Persisted result')}
        </Text>
        <pre>{JSON.stringify(cell.output, null, 2)}</pre>
      </RawOutput>
    );
  }

  if (
    cell.display.type === 'line' ||
    cell.display.type === 'bar' ||
    cell.display.type === 'area'
  ) {
    const chart = makeChart(cell.output, cell.display.xAxis, cell.display.yAxes);
    if (chart) {
      const chartProps = {
        height: 260,
        series: chart.series,
        xAxis: {type: 'category' as const},
        yAxis: {type: 'value' as const},
      };
      return (
        <ChartWrap>
          {cell.display.type === 'line' ? (
            <LineChart {...chartProps} />
          ) : cell.display.type === 'bar' ? (
            <BarChart {...chartProps} />
          ) : (
            <AreaChart {...chartProps} />
          )}
        </ChartWrap>
      );
    }
  }

  return (
    <TableScroller>
      <OutputTable $columnCount={cell.output.columns.length}>
        <SimpleTable.Header>
          {cell.output.columns.map(column => (
            <SimpleTable.HeaderCell key={column}>{column}</SimpleTable.HeaderCell>
          ))}
        </SimpleTable.Header>
        {cell.output.rows.map((row, index) => (
          <SimpleTable.Row key={index}>
            {row.map((value, valueIndex) => (
              <SimpleTable.RowCell key={valueIndex}>
                {formatValue(value)}
              </SimpleTable.RowCell>
            ))}
          </SimpleTable.Row>
        ))}
      </OutputTable>
    </TableScroller>
  );
}

function isTableOutput(value: unknown): value is TableOutput {
  return (
    typeof value === 'object' &&
    value !== null &&
    'columns' in value &&
    'rows' in value &&
    Array.isArray(value.columns) &&
    value.columns.every(column => typeof column === 'string') &&
    Array.isArray(value.rows) &&
    value.rows.every(row => Array.isArray(row))
  );
}

function makeChart(output: TableOutput, xAxis?: string, yAxes?: string[]) {
  if (!xAxis || !yAxes?.length) {
    return null;
  }
  const xIndex = output.columns.indexOf(xAxis);
  const yIndexes = yAxes.map(axis => output.columns.indexOf(axis));
  if (xIndex < 0 || yIndexes.some(index => index < 0)) {
    return null;
  }
  return {
    series: yAxes.map((axis, index) => ({
      seriesName: axis,
      data: output.rows.flatMap(row => {
        const value = row[yIndexes[index]!];
        return typeof value === 'number' ? [{name: formatValue(row[xIndex]), value}] : [];
      }),
    })),
  };
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  return '—';
}

const OutputMessage = styled(Text)`
  display: block;
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  background: ${p => p.theme.tokens.background.secondary};
  color: ${p => p.theme.tokens.content.secondary};
`;

const RawOutput = styled(Stack)`
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  background: ${p => p.theme.tokens.background.secondary};
  overflow: auto;
`;

const ChartWrap = styled('div')`
  padding: ${p => p.theme.space.lg};
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
`;

const TableScroller = styled('div')`
  overflow-x: auto;
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
`;

const OutputTable = styled(SimpleTable)<{$columnCount: number}>`
  min-width: 640px;
  grid-template-columns: repeat(${p => p.$columnCount}, minmax(140px, 1fr));
`;
