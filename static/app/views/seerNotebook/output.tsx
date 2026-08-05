import {Fragment, type ComponentProps} from 'react';
import {createPortal} from 'react-dom';
import {keyframes, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {observer} from 'mobx-react-lite';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {Chart} from 'sentry/components/seer/markdown/embeds/components/chart';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOverlay} from 'sentry/utils/useOverlay';
import type {CellStore} from 'sentry/views/seerNotebook/stores/cellStore';
import {isQueryResult} from 'sentry/views/seerNotebook/stores/visualization';

import type {InvestigationQueryResult} from './types';

type PersistedCellOutputProps = {cell: CellStore; disabled: boolean};

export function getOutputColumns(_output: unknown): string[] {
  return [];
}

export const PersistedCellOutput = observer(function PersistedCellOutput({
  cell,
}: PersistedCellOutputProps) {
  const queryOutput = isQueryResult(cell.output) ? cell.output : null;
  const hasResult = queryOutput !== null;
  const hasError = cell.executionStatusKind === 'error';
  if (
    !cell.hasExecutionFooter &&
    !hasResult &&
    !cell.isWaitingForDependencies &&
    !hasError
  ) {
    return null;
  }
  if (cell.outputStatus === 'restricted') {
    return (
      <OutputMessage>
        {t('You cannot access every project used by this investigation.')}
      </OutputMessage>
    );
  }

  return (
    <Stack gap="md">
      {cell.isExecutionRunning && hasResult ? (
        <Text variant="muted">{t('Refreshing saved result…')}</Text>
      ) : null}
      {queryOutput ? <QueryOutput cell={cell} output={queryOutput} /> : null}
      {cell.isWaitingForDependencies ? <DependencyWaitingStatus /> : null}
      {hasError ? <ExecutionError cell={cell} /> : null}
      {cell.hasExecutionFooter ? <ExecutionFooter cell={cell} /> : null}
    </Stack>
  );
});

export const TextCellExecutionOutput = observer(function TextCellExecutionOutput({
  cell,
}: {
  cell: CellStore;
}) {
  const hasError = cell.executionStatusKind === 'error';
  if (
    !cell.hasExecutionFooter &&
    !cell.partialMarkdown &&
    !cell.isWaitingForDependencies &&
    !hasError
  ) {
    return null;
  }

  return (
    <Stack gap="sm">
      {cell.isExecutionRunning && cell.partialMarkdown ? (
        <StreamPreview>
          <SeerMarkdown raw={cell.partialMarkdown} variant="streaming" />
        </StreamPreview>
      ) : null}
      {cell.isWaitingForDependencies ? <DependencyWaitingStatus /> : null}
      {hasError ? <ExecutionError cell={cell} /> : null}
      {cell.hasExecutionFooter ? <ExecutionFooter cell={cell} /> : null}
    </Stack>
  );
});

const ExecutionFooter = observer(function ExecutionFooter({cell}: {cell: CellStore}) {
  return (
    <ActivityDisclosure
      size="sm"
      disabled={cell.activityEntries.length === 0}
      expanded={cell.activityExpanded}
      onExpandedChange={expanded => cell.setActivityExpanded(expanded)}
    >
      <Disclosure.Title>
        <ExecutionStatus
          role={cell.executionStatusKind === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <StatusDot $status={cell.executionStatusKind} />
          <FlippingStatus key={cell.executionStatusLabelVersion}>
            {cell.executionStatusLabel}
          </FlippingStatus>
        </ExecutionStatus>
      </Disclosure.Title>
      <Disclosure.Content>
        <Stack gap="sm">
          {cell.executionStatusKind === 'error' ? (
            <Text size="sm" variant="danger">
              {cell.currentExecution?.error?.message ??
                (cell.kind === 'text'
                  ? t('The generation did not finish.')
                  : t('The query did not finish.'))}
            </Text>
          ) : null}
          {cell.activityEntries.map(entry => (
            <ActivityBlock key={entry.id}>
              {entry.content ? <SeerMarkdown raw={entry.content} /> : null}
              {entry.calls.map((call, callIndex) => (
                <Disclosure size="sm" key={callIndex}>
                  <Disclosure.Title>{call.function}</Disclosure.Title>
                  <Disclosure.Content>
                    <Stack gap="xs">
                      {call.code ? (
                        <div>
                          <Text size="xs" bold>
                            {t('Code')}
                          </Text>
                          <pre>{call.code}</pre>
                        </div>
                      ) : null}
                      <div>
                        <Text size="xs" bold>
                          {t('Result')}
                        </Text>
                        <pre>{call.result ?? t('No result yet')}</pre>
                      </div>
                    </Stack>
                  </Disclosure.Content>
                </Disclosure>
              ))}
              {entry.policyError ? (
                <Text size="sm" variant="danger">
                  {entry.policyError}
                </Text>
              ) : null}
            </ActivityBlock>
          ))}
          {cell.transcriptTruncated ? (
            <Text size="xs" variant="muted">
              {t('Large tool results were truncated.')}
            </Text>
          ) : null}
          {cell.pendingUserInput ? (
            <Stack gap="xs">
              <Text>
                {typeof cell.pendingUserInput.data.question === 'string'
                  ? cell.pendingUserInput.data.question
                  : t('Add context')}
              </Text>
              {cell.clarificationOptions.length ? (
                <Flex gap="xs" wrap="wrap">
                  {cell.clarificationOptions.map(option => (
                    <Button
                      size="xs"
                      key={option.value}
                      onClick={() => void cell.respondToPendingInput(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </Flex>
              ) : null}
              <ClarificationInput
                value={cell.clarificationDraft}
                onChange={event => cell.editClarificationDraft(event.target.value)}
                placeholder={t('Your response')}
              />
              <Button
                size="xs"
                disabled={!cell.clarificationDraft.trim()}
                onClick={() => void cell.respondToPendingInput()}
              >
                {t('Continue')}
              </Button>
            </Stack>
          ) : null}
        </Stack>
      </Disclosure.Content>
    </ActivityDisclosure>
  );
});

function DependencyWaitingStatus() {
  return (
    <WaitingStatus role="status">
      <WaitingSpinner aria-hidden="true" />
      <Text size="sm" variant="muted">
        {t('Waiting for earlier cells')}
      </Text>
    </WaitingStatus>
  );
}

function ExecutionError({cell}: {cell: CellStore}) {
  return (
    <ErrorMessage role="alert" size="sm" variant="danger">
      {cell.currentExecution?.error?.message ??
        (cell.kind === 'text'
          ? t('The generation did not finish.')
          : t('The query did not finish.'))}
    </ErrorMessage>
  );
}

const QueryOutput = observer(function QueryOutput({
  cell,
  output,
}: {
  cell: CellStore;
  output: InvestigationQueryResult;
}) {
  const activeView = cell.effectiveView;
  const chartData = cell.chartEmbedData;
  return (
    <OutputWrap>
      {cell.chartFallbackWarning ? (
        <Alert
          variant="warning"
          trailingItems={
            <Button size="xs" onClick={() => void cell.run()}>
              {t('Retry')}
            </Button>
          }
        >
          {cell.chartFallbackWarning}
        </Alert>
      ) : null}
      {activeView === 'chart' && chartData ? (
        <Chart
          name="chart"
          level="block"
          data={chartData as ComponentProps<typeof Chart>['data']}
        />
      ) : (
        <Stack gap="xs">
          <SeerMarkdown raw={output.tableMarkdown} />
          {output.isEmpty ? (
            <Text variant="muted">{t('No data returned for this query.')}</Text>
          ) : null}
        </Stack>
      )}
      {output.queryLinks.length ? (
        <UnderlyingQueries>
          <Disclosure size="sm">
            <Disclosure.Title>
              {t('%s underlying queries', output.queryLinks.length)}
            </Disclosure.Title>
            <Disclosure.Content>
              <pre>{JSON.stringify(output.queryLinks, null, 2)}</pre>
            </Disclosure.Content>
          </Disclosure>
        </UnderlyingQueries>
      ) : null}
    </OutputWrap>
  );
});

export const ChartSettingsControl = observer(function ChartSettingsControl({
  cell,
  disabled,
}: {
  cell: CellStore;
  disabled: boolean;
}) {
  const theme = useTheme();
  const {isOpen, triggerProps, overlayProps, arrowProps} = useOverlay({
    offset: 6,
    position: 'bottom-end',
    shouldApplyMinWidth: false,
    strategy: 'fixed',
  });
  if (!cell.queryResult) {
    return null;
  }

  return (
    <Fragment>
      <SettingsButton
        {...triggerProps}
        size="xs"
        variant="transparent"
        icon={<IconSettings />}
        aria-label={t('Result settings')}
      />
      {isOpen
        ? createPortal(
            <PositionWrapper zIndex={theme.zIndex.dropdown} {...overlayProps}>
              <Overlay arrowProps={arrowProps}>
                <SettingsPanel role="dialog" aria-label={t('Result settings')}>
                  <Text size="sm" bold>
                    {t('Result display')}
                  </Text>
                  <ViewSwitcher>
                    <Button
                      size="xs"
                      variant={cell.effectiveView === 'table' ? 'primary' : 'secondary'}
                      disabled={disabled}
                      onClick={() => cell.setResultView('table')}
                    >
                      {t('Table')}
                    </Button>
                    <Button
                      size="xs"
                      variant={cell.effectiveView === 'chart' ? 'primary' : 'secondary'}
                      disabled={disabled || !cell.chartAvailable}
                      onClick={() => cell.setResultView('chart')}
                    >
                      {t('Chart')}
                    </Button>
                  </ViewSwitcher>
                  {cell.chartAvailable ? (
                    <ChartPresentation cell={cell} disabled={disabled} />
                  ) : null}
                </SettingsPanel>
              </Overlay>
            </PositionWrapper>,
            document.body
          )
        : null}
    </Fragment>
  );
});

const ChartPresentation = observer(function ChartPresentation({
  cell,
  disabled,
}: {
  cell: CellStore;
  disabled: boolean;
}) {
  return (
    <Stack gap="sm">
      <Text size="sm" bold>
        {t('Chart presentation')}
      </Text>
      <PresentationGrid>
        <label>
          <Text size="xs">{t('Chart type')}</Text>
          <PresentationSelect
            disabled={disabled}
            value={cell.chartPresentationType}
            onChange={event =>
              cell.applyVisualizationChange({
                type: event.target.value as 'line' | 'bar' | 'area',
              })
            }
          >
            {cell.compatibleChartTypes.map(type => (
              <option value={type} key={type}>
                {type}
              </option>
            ))}
          </PresentationSelect>
        </label>
        <PresentationField
          disabled={disabled}
          label={t('Title')}
          value={cell.display.title ?? ''}
          onChange={title => cell.applyVisualizationChange({title})}
        />
        <PresentationField
          disabled={disabled}
          label={t('Subtitle')}
          value={cell.display.subtitle ?? ''}
          onChange={subtitle => cell.applyVisualizationChange({subtitle})}
        />
        <PresentationField
          disabled={disabled}
          label={t('Axis label')}
          value={cell.display.axisLabel ?? ''}
          onChange={axisLabel => cell.applyVisualizationChange({axisLabel})}
        />
        <label>
          <Text size="xs">{t('Unit')}</Text>
          <PresentationSelect
            disabled={disabled}
            value={cell.display.unit ?? 'number'}
            onChange={event =>
              cell.applyVisualizationChange({
                unit: event.target.value as
                  | 'number'
                  | 'percentage'
                  | 'duration'
                  | 'bytes',
              })
            }
          >
            {(['number', 'percentage', 'duration', 'bytes'] as const).map(unit => (
              <option value={unit} key={unit}>
                {unit}
              </option>
            ))}
          </PresentationSelect>
        </label>
        <label>
          <input
            type="checkbox"
            disabled={disabled}
            checked={cell.display.showLegend ?? true}
            onChange={event =>
              cell.applyVisualizationChange({
                showLegend: event.target.checked,
              })
            }
          />{' '}
          {t('Show legend')}
        </label>
        <label>
          <input
            type="checkbox"
            disabled={disabled}
            checked={cell.display.stacked ?? false}
            onChange={event =>
              cell.applyVisualizationChange({stacked: event.target.checked})
            }
          />{' '}
          {t('Stack series')}
        </label>
      </PresentationGrid>
    </Stack>
  );
});

function PresentationField({
  label,
  onChange,
  value,
  disabled,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label>
      <Text size="xs">{label}</Text>
      <ClarificationInput
        disabled={disabled}
        value={value}
        onChange={event => onChange(event.target.value)}
      />
    </label>
  );
}

const OutputWrap = styled('section')`
  display: grid;
  gap: ${p => p.theme.space.md};

  > [data-test-id='seer-chart-embed'] {
    border: 0;
    border-radius: 0;
  }
`;
const UnderlyingQueries = styled('div')`
  width: 100%;

  [data-disclosure] {
    width: 100%;
  }
`;
const SettingsButton = styled(Button)`
  width: 24px;
  min-width: 24px;
  height: 24px;
  min-height: 24px;
  padding: 4px;
`;
const SettingsPanel = styled(Stack)`
  width: min(420px, calc(100vw - 32px));
  max-height: min(620px, calc(100vh - 48px));
  overflow-y: auto;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.lg};
`;
const ViewSwitcher = styled(Flex)`
  gap: ${p => p.theme.space.xs};
`;
const OutputMessage = styled(Text)`
  padding: ${p => p.theme.space.md};
`;
const ErrorMessage = styled(Text)`
  display: block;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
`;
const WaitingStatus = styled(Flex)`
  align-items: center;
  gap: ${p => p.theme.space.sm};
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.lg};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
`;
const WaitingSpinner = styled('span')`
  width: 12px;
  height: 12px;
  border: 2px solid ${p => p.theme.tokens.border.secondary};
  border-right-color: transparent;
  border-radius: 50%;
  animation: ${keyframes`to { transform: rotate(360deg); }`} 700ms linear infinite;
`;
const ActivityDisclosure = styled(Disclosure)`
  border: 0;
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: 0;

  > div:first-of-type {
    padding-right: 0;
    border-radius: 0;
  }

  > div:first-of-type > button:first-of-type {
    border-radius: 0;
  }
`;
const ExecutionStatus = styled('span')`
  display: inline-flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  min-height: 20px;
`;
const StatusDot = styled('span')<{$status: CellStore['executionStatusKind']}>`
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  border-radius: 50%;
  color: ${p =>
    p.$status === 'error'
      ? p.theme.tokens.content.danger
      : p.$status === 'working'
        ? p.theme.tokens.content.accent
        : p.theme.tokens.content.secondary};
  background: currentcolor;
`;
const flipStatus = keyframes`
  from {
    opacity: 0;
    transform: translateY(5px) rotateX(-35deg);
  }
  to {
    opacity: 1;
    transform: translateY(0) rotateX(0);
  }
`;
const FlippingStatus = styled('span')`
  animation: ${flipStatus} 180ms ease-out;
`;
const ActivityBlock = styled('div')`
  pre {
    max-height: 240px;
    overflow: auto;
    white-space: pre-wrap;
  }
`;
const StreamPreview = styled('div')`
  opacity: 0.8;
  border-left: 2px solid ${p => p.theme.tokens.border.accent.vibrant};
  padding-left: ${p => p.theme.space.md};
`;
const ClarificationInput = styled('input')`
  width: 100%;
  padding: ${p => p.theme.space.sm};
`;
const PresentationGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: ${p => p.theme.space.sm};
`;
const PresentationSelect = styled('select')`
  width: 100%;
  padding: ${p => p.theme.space.sm};
`;
