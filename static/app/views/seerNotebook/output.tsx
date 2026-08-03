import {useEffect, useState, type ReactNode} from 'react';
import styled from '@emotion/styled';
import {observer} from 'mobx-react-lite';

import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {AreaChart} from 'sentry/components/charts/areaChart';
import {BarChart} from 'sentry/components/charts/barChart';
import {LineChart} from 'sentry/components/charts/lineChart';
import {Chart} from 'sentry/components/seer/markdown/embeds/components/chart';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconClose, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {CellStore} from 'sentry/views/seerNotebook/stores/cellStore';
import {isQueryResult} from 'sentry/views/seerNotebook/stores/visualization';

import type {
  InvestigationCell,
  InvestigationChartUnit,
  InvestigationDisplay,
  InvestigationQueryResult,
  InvestigationTableColumn,
  InvestigationVisualization,
} from './types';

type LegacyTableOutput = {
  columns: string[];
  rows: unknown[][];
};

type PersistedCellOutputProps = {
  cell: CellStore;
  disabled: boolean;
};

export function getOutputColumns(output: unknown): string[] {
  if (isQueryResult(output)) {
    return output.table.columns.map(column => column.key);
  }
  return isLegacyTableOutput(output) ? output.columns : [];
}

export const PersistedCellOutput = observer(function PersistedCellOutput({
  cell,
  disabled,
}: PersistedCellOutputProps) {
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
    const persistedMessage =
      cell.currentExecution?.error?.message ?? t('The persisted cell execution failed.');
    const message =
      persistedMessage === 'agent_run_errored' ||
      persistedMessage.startsWith('unexpected_terminal_status:')
        ? t("We couldn't finish this query. Try running it again.")
        : persistedMessage;
    return (
      <ErrorOutput role="alert" align="center" justify="between" gap="lg" wrap="wrap">
        <Stack gap="xs">
          <Text bold>{t('Query failed')}</Text>
          <Text size="sm">{message}</Text>
        </Stack>
        <Button
          size="xs"
          variant="secondary"
          disabled={disabled || !cell.canRun}
          onClick={() => void cell.retryRun().catch(() => {})}
        >
          {t('Retry')}
        </Button>
      </ErrorOutput>
    );
  }
  if (cell.outputStatus !== 'available') {
    return <ExecutionProgress />;
  }
  if (isQueryResult(cell.output)) {
    return <TypedQueryOutput cell={cell} disabled={disabled} output={cell.output} />;
  }
  if (isLegacyTableOutput(cell.output)) {
    return <LegacyOutput cell={cell.toInvestigationCell()} output={cell.output} />;
  }
  return (
    <RawOutput>
      <Text size="sm" bold>
        {t('Persisted result')}
      </Text>
      <pre>{JSON.stringify(cell.output, null, 2)}</pre>
    </RawOutput>
  );
});

export const TextCellExecutionOutput = observer(function TextCellExecutionOutput({
  cell,
}: {
  cell: CellStore;
}) {
  if (cell.outputStatus === 'notRun' || cell.outputStatus === 'available') {
    return null;
  }
  if (cell.outputStatus === 'restricted') {
    return (
      <OutputMessage>
        {t('This generated text uses project data you do not have permission to view.')}
      </OutputMessage>
    );
  }
  if (cell.outputStatus === 'failed') {
    const message =
      cell.currentExecution?.error?.message ?? t('The text generation failed.');
    return (
      <ErrorOutput role="alert" align="center" justify="between" gap="lg" wrap="wrap">
        <Stack gap="xs">
          <Text bold>{t('Generation failed')}</Text>
          <Text size="sm">{message}</Text>
        </Stack>
        <Button
          size="xs"
          variant="secondary"
          disabled={!cell.canRun}
          onClick={() => void cell.retryRun().catch(() => {})}
        >
          {t('Retry')}
        </Button>
      </ErrorOutput>
    );
  }
  return <OutputMessage>{t('Writing Markdown…')}</OutputMessage>;
});

function ExecutionProgress() {
  const stages = [
    t('Choosing where to look'),
    t('Building the query'),
    t('Fetching data'),
    t('Preparing the visualization'),
  ];
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setStage(current => Math.min(current + 1, stages.length - 1)),
      2500
    );
    return () => window.clearInterval(timer);
  }, [stages.length]);
  return <OutputMessage>{stages[stage]}…</OutputMessage>;
}

const TypedQueryOutput = observer(function TypedQueryOutput({
  cell,
  disabled,
  output,
}: PersistedCellOutputProps & {
  output: InvestigationQueryResult;
}) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const chartAvailable = cell.chartAvailable;
  const activeView = cell.effectiveView;
  const {visualization, isFallback} = cell.visualizationResolution;
  const chartData = cell.chartData;

  const changeView = (view: 'table' | 'chart' | 'both') => {
    cell.setResultView(view);
    setIsSettingsOpen(false);
  };

  const showChart =
    chartAvailable &&
    visualization !== null &&
    chartData !== null &&
    (activeView === 'chart' || activeView === 'both');
  const showTable = activeView === 'table' || activeView === 'both' || !showChart;
  const chartUnavailableTitle =
    output.chartUnavailableReason ?? t('No meaningful chart is available.');

  return (
    <OutputWrap>
      {showChart ? (
        <ChartSurface>
          {isFallback ? (
            <InlineNotice>
              {t(
                'The previous visualization no longer fits this result, so the new suggestion is shown.'
              )}
            </InlineNotice>
          ) : null}
          <Chart
            name="chart"
            level="block"
            data={{
              title: visualization.title,
              subtitle: visualization.subtitle ?? undefined,
              show_title: false,
              frameless: true,
              visualization: visualization.type,
              x_axis: output.chart!.xAxis,
              y_axis_unit: visualization.unit,
              y_axis_label: visualization.axisLabel ?? undefined,
              stacked: visualization.stacked,
              show_legend: visualization.showLegend,
              series: chartData,
            }}
          />
          {disabled ? null : (
            <ChartSettingsButton
              size="xs"
              variant="secondary"
              icon={<IconSettings />}
              aria-label={t('Chart settings')}
              onClick={() => setIsSettingsOpen(true)}
            />
          )}
          {isSettingsOpen ? (
            <ChartSettingsOverlay>
              <Flex align="center" justify="between" gap="sm">
                <Text bold>{t('Chart settings')}</Text>
                <Button
                  size="xs"
                  variant="transparent"
                  icon={<IconClose />}
                  aria-label={t('Close chart settings')}
                  onClick={() => setIsSettingsOpen(false)}
                />
              </Flex>
              <VisualizationEditor
                cell={cell}
                output={output}
                visualization={visualization}
              />
            </ChartSettingsOverlay>
          ) : null}
        </ChartSurface>
      ) : null}
      {showTable ? <TypedTable output={output} /> : null}

      <ResultFooter columns="minmax(0, 1fr) auto" align="start" gap="sm">
        <QueryDetails size="xs">
          <Disclosure.Title>{t('Query details')}</Disclosure.Title>
          <QueryDetailsBody>
            <InlineCode>{output.query.query || t('(no filter)')}</InlineCode>
          </QueryDetailsBody>
        </QueryDetails>
        <ViewTabs columns="repeat(3, minmax(64px, 1fr))" gap="0">
          {(['table', 'chart', 'both'] as const).map(view => {
            const unavailable = view !== 'table' && !chartAvailable;
            return (
              <Tooltip key={view} title={unavailable ? chartUnavailableTitle : undefined}>
                <ViewTabCell>
                  <Button
                    size="xs"
                    variant={activeView === view ? 'primary' : 'secondary'}
                    disabled={unavailable}
                    onClick={() => changeView(view)}
                  >
                    {view === 'table'
                      ? t('Table')
                      : view === 'chart'
                        ? t('Chart')
                        : t('Both')}
                  </Button>
                </ViewTabCell>
              </Tooltip>
            );
          })}
        </ViewTabs>
      </ResultFooter>
    </OutputWrap>
  );
});

const VisualizationEditor = observer(function VisualizationEditor({
  cell,
  output,
  visualization,
}: {
  cell: CellStore;
  output: InvestigationQueryResult;
  visualization: InvestigationVisualization;
}) {
  const seriesOptions = output.chart?.series.map(series => series.name) ?? [];
  const availableColumns = new Set(output.table.columns.map(column => column.key));
  const seriesFieldOptions = output.query.groupBy.filter(field =>
    availableColumns.has(field)
  );
  const onChange = (change: Partial<InvestigationDisplay>) =>
    cell.applyVisualizationChange(change);
  return (
    <Stack gap="md">
      <EditorGrid>
        <EditorLabel>
          <Text size="xs" variant="muted">
            {t('Visualization')}
          </Text>
          <EditorSelect
            aria-label={t('Visualization type')}
            value={visualization.type}
            onChange={event =>
              onChange({
                type: event.target.value as InvestigationDisplay['type'],
              })
            }
          >
            {(['line', 'area', 'bar', 'heatmap', 'wheel'] as const).map(type => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </EditorSelect>
        </EditorLabel>
        <EditorLabel>
          <Text size="xs" variant="muted">
            {t('X-axis')}
          </Text>
          <EditorSelect
            aria-label={t('X-axis field')}
            value={visualization.xField}
            onChange={event => onChange({xAxis: event.target.value})}
          >
            <option value={visualization.xField}>{visualization.xField}</option>
          </EditorSelect>
        </EditorLabel>
        <EditorLabel>
          <Text size="xs" variant="muted">
            {t('Y-axis')}
          </Text>
          <EditorSelect
            aria-label={t('Y-axis series')}
            value={visualization.yFields[0]}
            onChange={event => onChange({yAxes: [event.target.value]})}
          >
            {seriesOptions.map(series => (
              <option key={series} value={series}>
                {series}
              </option>
            ))}
          </EditorSelect>
        </EditorLabel>
        <EditorLabel>
          <Text size="xs" variant="muted">
            {t('Series / color')}
          </Text>
          <EditorSelect
            aria-label={t('Series or color field')}
            value={visualization.seriesField ?? ''}
            onChange={event => onChange({seriesField: event.target.value || undefined})}
          >
            <option value="">{t('None')}</option>
            {seriesFieldOptions.map(field => (
              <option key={field} value={field}>
                {field}
              </option>
            ))}
          </EditorSelect>
        </EditorLabel>
        <EditorLabel>
          <Text size="xs" variant="muted">
            {t('Unit')}
          </Text>
          <EditorSelect
            aria-label={t('Y-axis unit')}
            value={visualization.unit}
            onChange={event =>
              onChange({unit: event.target.value as InvestigationChartUnit})
            }
          >
            {(['number', 'percentage', 'duration', 'bytes'] as const).map(unit => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </EditorSelect>
        </EditorLabel>
        <EditorLabel>
          <Text size="xs" variant="muted">
            {t('Axis label')}
          </Text>
          <EditorInput
            aria-label={t('Y-axis label')}
            value={visualization.axisLabel ?? ''}
            onChange={event => onChange({axisLabel: event.target.value})}
          />
        </EditorLabel>
        <EditorLabel>
          <Text size="xs" variant="muted">
            {t('Series layout')}
          </Text>
          <EditorSelect
            aria-label={t('Series layout')}
            value={visualization.stacked ? 'stacked' : 'grouped'}
            onChange={event => onChange({stacked: event.target.value === 'stacked'})}
          >
            <option value="grouped">{t('Grouped')}</option>
            <option value="stacked">{t('Stacked')}</option>
          </EditorSelect>
        </EditorLabel>
        <EditorLabel>
          <Text size="xs" variant="muted">
            {t('Sort')}
          </Text>
          <EditorSelect
            aria-label={t('Chart sort')}
            value={visualization.sort}
            onChange={event =>
              onChange({
                sort: event.target.value as InvestigationDisplay['sort'],
              })
            }
          >
            <option value="none">{t('Original')}</option>
            <option value="ascending">{t('Ascending')}</option>
            <option value="descending">{t('Descending')}</option>
          </EditorSelect>
        </EditorLabel>
        <EditorLabel>
          <Text size="xs" variant="muted">
            {t('Top N')}
          </Text>
          <EditorInput
            aria-label={t('Top N points')}
            min={1}
            max={20}
            type="number"
            value={visualization.topN ?? ''}
            onChange={event => {
              const value = event.target.valueAsNumber;
              onChange({
                topN: Number.isNaN(value) ? undefined : Math.min(Math.max(value, 1), 20),
              });
            }}
          />
        </EditorLabel>
        <EditorCheckbox>
          <input
            type="checkbox"
            checked={visualization.showLegend}
            onChange={event => onChange({showLegend: event.target.checked})}
          />
          <Text size="sm">{t('Legend')}</Text>
        </EditorCheckbox>
      </EditorGrid>
      <NlpEditor>
        <EditorInput
          aria-label={t('Describe a chart change')}
          placeholder={t('Make this a stacked area chart grouped by release')}
          value={cell.visualizationPrompt}
          onChange={event => cell.editVisualizationPrompt(event.target.value)}
        />
        <Button
          size="xs"
          busy={cell.visualizationSuggestionState === 'loading'}
          disabled={!cell.visualizationPrompt.trim()}
          onClick={() => void cell.requestVisualizationSuggestion()}
        >
          {t('Apply')}
        </Button>
        {cell.revisedQueryIntent ? (
          <Button
            size="xs"
            variant="warning"
            onClick={() => void cell.confirmRevisedQuery().catch(() => {})}
          >
            {t('Update query and run')}
          </Button>
        ) : null}
      </NlpEditor>
      {cell.revisedQueryIntent ? (
        <InlineNotice>
          {t(
            'This change needs data that is not in the saved result. No query has run yet.'
          )}
        </InlineNotice>
      ) : null}
      {cell.visualizationError ? (
        <InlineNotice>{visualizationErrorMessage(cell.visualizationError)}</InlineNotice>
      ) : null}
    </Stack>
  );
});

function TypedTable({output}: {output: InvestigationQueryResult}) {
  const columns = output.table.columns.length
    ? output.table.columns
    : [{key: 'result', label: t('Result'), type: 'string' as const}];

  return (
    <TableScroller>
      <OutputTable $columnCount={columns.length}>
        <SimpleTable.Header>
          {columns.map(column => (
            <SimpleTable.HeaderCell key={column.key}>
              {column.label}
            </SimpleTable.HeaderCell>
          ))}
        </SimpleTable.Header>
        {output.table.rows.length === 0 ? (
          <SimpleTable.Empty>{t('No data returned for this query.')}</SimpleTable.Empty>
        ) : null}
        {output.table.rows.map((row, index) => (
          <SimpleTable.Row key={index}>
            {row.map((value, valueIndex) => (
              <SimpleTable.RowCell key={valueIndex}>
                {formatTypedValue(columns[valueIndex]!, value)}
              </SimpleTable.RowCell>
            ))}
          </SimpleTable.Row>
        ))}
      </OutputTable>
    </TableScroller>
  );
}

function LegacyOutput({
  cell,
  output,
}: {
  cell: InvestigationCell;
  output: LegacyTableOutput;
}) {
  if (
    cell.display.type === 'line' ||
    cell.display.type === 'bar' ||
    cell.display.type === 'area'
  ) {
    const chart = makeLegacyChart(output, cell.display.xAxis, cell.display.yAxes);
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
      <OutputTable $columnCount={output.columns.length}>
        <SimpleTable.Header>
          {output.columns.map(column => (
            <SimpleTable.HeaderCell key={column}>{column}</SimpleTable.HeaderCell>
          ))}
        </SimpleTable.Header>
        {output.rows.map((row, index) => (
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

function isLegacyTableOutput(value: unknown): value is LegacyTableOutput {
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

function visualizationErrorMessage(code: string): string {
  if (code === 'unavailable_y_axis' || code === 'unavailable_series_field') {
    return t('That setting needs a field that is not in this saved result.');
  }
  if (code === 'suggestion_failed') {
    return t('The chart suggestion could not be generated. Try again.');
  }
  return t('This chart setting is not valid for the saved result.');
}

function formatTypedValue(
  column: InvestigationTableColumn,
  value: string | number | boolean | null
): ReactNode {
  if (value === null) {
    return '—';
  }
  if (column.type === 'datetime' && typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
  }
  if (column.type === 'duration' && typeof value === 'number') {
    return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${value.toFixed(0)}ms`;
  }
  if (column.type === 'percentage' && typeof value === 'number') {
    return `${value.toLocaleString()}%`;
  }
  if (column.type === 'bytes' && typeof value === 'number') {
    return `${new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 1,
    }).format(value)} B`;
  }
  if (column.type === 'boolean') {
    return value ? t('Yes') : t('No');
  }
  if (['issue', 'trace', 'event', 'project', 'release'].includes(column.type)) {
    return <InlineCode>{String(value)}</InlineCode>;
  }
  return String(value);
}

function makeLegacyChart(output: LegacyTableOutput, xAxis?: string, yAxes?: string[]) {
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
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
    ? String(value)
    : '—';
}

const OutputWrap = styled('section')`
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
`;

const OutputMessage = styled(Text)`
  display: block;
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  background: ${p => p.theme.tokens.background.secondary};
  color: ${p => p.theme.tokens.content.secondary};
`;

const ErrorOutput = styled(Flex)`
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  border-top: 1px solid ${p => p.theme.tokens.border.danger.moderate};
  background: ${p => p.theme.tokens.background.transparent.danger.muted};
`;

const InlineNotice = styled(Text)`
  display: block;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.lg};
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
`;

const ChartSurface = styled('div')`
  position: relative;
  overflow: hidden;
`;

const ChartSettingsButton = styled(Button)`
  position: absolute;
  z-index: 2;
  top: ${p => p.theme.space.sm};
  right: ${p => p.theme.space.lg};
`;

const ChartSettingsOverlay = styled(Stack)`
  position: absolute;
  z-index: 3;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(380px, 100%);
  padding: ${p => p.theme.space.lg};
  border-left: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.primary};
  box-shadow: ${p => p.theme.shadow.medium};
  overflow-y: auto;
`;

const TableScroller = styled('div')`
  overflow-x: auto;
`;

const OutputTable = styled(SimpleTable)<{$columnCount: number}>`
  min-width: 640px;
  grid-template-columns: repeat(${p => p.$columnCount}, minmax(140px, 1fr));
  border: 0;
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: 0;

  [role='row'] {
    border-radius: 0;
  }
`;

const ResultFooter = styled(Grid)`
  min-height: 44px;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.lg};
  background: ${p => p.theme.tokens.background.secondary};
`;

const QueryDetails = styled(Disclosure)`
  min-width: 0;
`;

const QueryDetailsBody = styled(Disclosure.Content)`
  max-width: 100%;
  overflow-x: auto;
`;

const ViewTabs = styled(Grid)`
  align-self: start;

  button {
    width: 100%;
    border-radius: 0;
  }
`;

const ViewTabCell = styled('span')`
  min-width: 0;

  &:first-of-type button {
    border-radius: ${p => p.theme.radius.sm} 0 0 ${p => p.theme.radius.sm};
  }

  &:not(:first-of-type) button {
    margin-left: -1px;
  }

  &:last-of-type button {
    border-radius: 0 ${p => p.theme.radius.sm} ${p => p.theme.radius.sm} 0;
  }
`;

const InlineCode = styled('code')`
  font-family: ${p => p.theme.font.family.mono};
  font-size: ${p => p.theme.font.size.sm};
`;

const EditorGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: ${p => p.theme.space.sm};
`;

const EditorLabel = styled('label')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xs};
`;

const EditorSelect = styled('select')`
  min-height: 32px;
  padding: 0 ${p => p.theme.space.sm};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.primary};
  color: ${p => p.theme.tokens.content.primary};
`;

const EditorInput = styled('input')`
  min-height: 32px;
  padding: 0 ${p => p.theme.space.sm};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  background: ${p => p.theme.tokens.background.primary};
  color: ${p => p.theme.tokens.content.primary};
`;

const EditorCheckbox = styled('label')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  padding-top: ${p => p.theme.space.lg};
`;

const NlpEditor = styled(Flex)`
  gap: ${p => p.theme.space.sm};

  ${EditorInput} {
    flex: 1;
  }
`;
