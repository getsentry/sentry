import {Fragment} from 'react';
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
import type {BlockStore} from 'sentry/views/seerNotebook/stores/blockStore';
import {isQueryResult} from 'sentry/views/seerNotebook/stores/visualization';

import type {InvestigationQueryResult} from './types';

type PersistedBlockOutputProps = {block: BlockStore; disabled: boolean};

/** @public */ export function getOutputColumns(_output: unknown): string[] {
  return [];
}

export const PersistedBlockOutput = observer(({block}: PersistedBlockOutputProps) => {
  const queryOutput = isQueryResult(block.output) ? block.output : null;
  const hasResult = queryOutput !== null;
  const hasError = block.executionStatusKind === 'error';
  if (
    !block.hasExecutionFooter &&
    !hasResult &&
    !block.isWaitingForDependencies &&
    !block.isBlockedByDependencies &&
    !hasError
  ) {
    return null;
  }
  if (block.outputStatus === 'restricted') {
    return (
      <OutputMessage>
        {t('You cannot access every project used by this investigation.')}
      </OutputMessage>
    );
  }

  return (
    <Stack gap="md">
      {block.isExecutionRunning && hasResult ? (
        <Text variant="muted">{t('Refreshing saved result…')}</Text>
      ) : null}
      {queryOutput ? <QueryOutput block={block} output={queryOutput} /> : null}
      {block.isWaitingForDependencies ? <DependencyWaitingStatus /> : null}
      {block.isBlockedByDependencies ? <DependencyBlockedStatus /> : null}
      {hasError ? <ExecutionError block={block} /> : null}
      {block.hasExecutionFooter ? <ExecutionFooter block={block} /> : null}
    </Stack>
  );
});

export const TextBlockExecutionOutput = observer(({block}: {block: BlockStore}) => {
  const hasError = block.executionStatusKind === 'error';
  if (
    !block.hasExecutionFooter &&
    !block.partialMarkdown &&
    !block.isWaitingForDependencies &&
    !block.isBlockedByDependencies &&
    !hasError
  ) {
    return null;
  }

  return (
    <Stack gap="sm">
      {block.isExecutionRunning && block.partialMarkdown ? (
        <StreamPreview>
          <SeerMarkdown raw={block.partialMarkdown} variant="streaming" />
        </StreamPreview>
      ) : null}
      {block.isWaitingForDependencies ? <DependencyWaitingStatus /> : null}
      {block.isBlockedByDependencies ? <DependencyBlockedStatus /> : null}
      {hasError ? <ExecutionError block={block} /> : null}
      {block.hasExecutionFooter ? <ExecutionFooter block={block} /> : null}
    </Stack>
  );
});

const ExecutionFooter = observer(({block}: {block: BlockStore}) => {
  return (
    <ActivityDisclosure
      size="sm"
      disabled={
        !block.currentExecution ||
        (block.isExecutionRunning && block.activityEntries.length === 0)
      }
      expanded={block.activityExpanded}
      onExpandedChange={expanded => block.setActivityExpanded(expanded)}
    >
      <Disclosure.Title>
        <ExecutionStatus
          role={block.executionStatusKind === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <StatusDot $status={block.executionStatusKind} />
          <FlippingStatus key={block.executionStatusLabelVersion}>
            {block.executionStatusLabel}
          </FlippingStatus>
        </ExecutionStatus>
      </Disclosure.Title>
      <Disclosure.Content>
        <Stack gap="sm">
          {block.isLoadingExecutionActivity ? (
            <Text size="sm" variant="muted">
              {t('Loading activity…')}
            </Text>
          ) : null}
          {block.activityEntries.map(entry => (
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
          {block.transcriptTruncated ? (
            <Text size="xs" variant="muted">
              {t('Large tool results were truncated.')}
            </Text>
          ) : null}
          {block.pendingUserInput ? (
            <Stack gap="xs">
              <Text>
                {typeof block.pendingUserInput.data.question === 'string'
                  ? block.pendingUserInput.data.question
                  : t('Add context')}
              </Text>
              {block.clarificationOptions.length ? (
                <Flex gap="xs" wrap="wrap">
                  {block.clarificationOptions.map(option => (
                    <Button
                      size="xs"
                      key={option.value}
                      onClick={() => void block.respondToPendingInput(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </Flex>
              ) : null}
              <ClarificationInput
                value={block.clarificationDraft}
                onChange={event => block.editClarificationDraft(event.target.value)}
                placeholder={t('Your response')}
              />
              <Button
                size="xs"
                disabled={!block.clarificationDraft.trim()}
                onClick={() => void block.respondToPendingInput()}
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
        {t('Waiting for earlier blocks')}
      </Text>
    </WaitingStatus>
  );
}

function DependencyBlockedStatus() {
  return (
    <ErrorMessage role="alert" size="sm" variant="danger">
      {t('Blocked because an earlier block did not complete.')}
    </ErrorMessage>
  );
}

function ExecutionError({block}: {block: BlockStore}) {
  return (
    <ErrorMessage role="alert" size="sm" variant="danger">
      {block.currentExecution?.error?.message ??
        (block.kind === 'text'
          ? t('The generation did not finish.')
          : t('The query did not finish.'))}
    </ErrorMessage>
  );
}

const QueryOutput = observer(
  ({block, output}: {block: BlockStore; output: InvestigationQueryResult}) => {
    const activeView = block.effectiveView;
    const chartData = block.chartEmbedData;
    return (
      <OutputWrap>
        {block.chartFallbackWarning ? (
          <Alert
            variant="warning"
            trailingItems={
              <Button size="xs" onClick={() => void block.run()}>
                {t('Retry')}
              </Button>
            }
          >
            {block.chartFallbackWarning}
          </Alert>
        ) : null}
        {activeView === 'chart' && chartData ? (
          <Chart name="chart" level="block" data={chartData} />
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
  }
);

export const ChartSettingsControl = observer(
  ({block, disabled}: {block: BlockStore; disabled: boolean}) => {
    const theme = useTheme();
    const {isOpen, triggerProps, overlayProps, arrowProps} = useOverlay({
      offset: 6,
      position: 'bottom-end',
      shouldApplyMinWidth: false,
      strategy: 'fixed',
    });
    if (!block.queryResult) {
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
                        variant={
                          block.effectiveView === 'table' ? 'primary' : 'secondary'
                        }
                        disabled={disabled}
                        onClick={() => block.setResultView('table')}
                      >
                        {t('Table')}
                      </Button>
                      <Button
                        size="xs"
                        variant={
                          block.effectiveView === 'chart' ? 'primary' : 'secondary'
                        }
                        disabled={disabled || !block.chartAvailable}
                        onClick={() => block.setResultView('chart')}
                      >
                        {t('Chart')}
                      </Button>
                    </ViewSwitcher>
                    {block.chartAvailable ? (
                      <ChartPresentation block={block} disabled={disabled} />
                    ) : null}
                  </SettingsPanel>
                </Overlay>
              </PositionWrapper>,
              document.body
            )
          : null}
      </Fragment>
    );
  }
);

const ChartPresentation = observer(
  ({block, disabled}: {block: BlockStore; disabled: boolean}) => {
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
              value={block.chartPresentationType}
              onChange={event =>
                block.applyVisualizationChange({
                  type: event.target.value as 'line' | 'bar' | 'area',
                })
              }
            >
              {block.compatibleChartTypes.map(type => (
                <option value={type} key={type}>
                  {type}
                </option>
              ))}
            </PresentationSelect>
          </label>
          <PresentationField
            disabled={disabled}
            label={t('Title')}
            value={block.display.title ?? ''}
            onChange={title => block.applyVisualizationChange({title})}
          />
          <PresentationField
            disabled={disabled}
            label={t('Subtitle')}
            value={block.display.subtitle ?? ''}
            onChange={subtitle => block.applyVisualizationChange({subtitle})}
          />
          <PresentationField
            disabled={disabled}
            label={t('Axis label')}
            value={block.display.axisLabel ?? ''}
            onChange={axisLabel => block.applyVisualizationChange({axisLabel})}
          />
          <label>
            <Text size="xs">{t('Unit')}</Text>
            <PresentationSelect
              disabled={disabled}
              value={block.display.unit ?? 'number'}
              onChange={event =>
                block.applyVisualizationChange({
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
              checked={block.display.showLegend ?? true}
              onChange={event =>
                block.applyVisualizationChange({
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
              checked={block.display.stacked ?? false}
              onChange={event =>
                block.applyVisualizationChange({stacked: event.target.checked})
              }
            />{' '}
            {t('Stack series')}
          </label>
        </PresentationGrid>
      </Stack>
    );
  }
);

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
const StatusDot = styled('span')<{$status: BlockStore['executionStatusKind']}>`
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
