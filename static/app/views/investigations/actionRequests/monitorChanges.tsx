import styled from '@emotion/styled';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import {IconSiren} from '@sentry/icons/siren';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {DetectorPriorityLevel} from 'sentry/types/workflowEngine/dataConditions';
import type {MetricDetectorConfig} from 'sentry/types/workflowEngine/detectors';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {getConditionDescription} from 'sentry/views/detectors/components/details/metric/detect';
import {getStaticDetectorThresholdSuffix} from 'sentry/views/detectors/utils/metricDetectorSuffix';
import {percentThresholdAbsoluteToDelta} from 'sentry/views/detectors/utils/percentThreshold';
import type {SourceMonitor} from 'sentry/views/investigations/source';
import type {
  InvestigationDetectorChangeKey,
  InvestigationUpdateDetectorAction,
} from 'sentry/views/investigations/types';

type ChangeField = {
  getLabel: () => string;
  monospace: boolean;
};

const CHANGE_FIELDS = {
  query: {getLabel: () => t('Query'), monospace: true},
  aggregate: {getLabel: () => t('Aggregate'), monospace: true},
  environment: {getLabel: () => t('Environment'), monospace: false},
  timeWindowSeconds: {getLabel: () => t('Interval'), monospace: false},
  highThreshold: {getLabel: () => t('High threshold'), monospace: false},
  mediumThreshold: {getLabel: () => t('Medium threshold'), monospace: false},
  resolutionThreshold: {getLabel: () => t('Resolution threshold'), monospace: false},
} satisfies Record<InvestigationDetectorChangeKey, ChangeField>;

const CHANGE_KEYS = Object.keys(CHANGE_FIELDS) as InvestigationDetectorChangeKey[];

const PRIORITY_CHANGE_KEYS: Partial<Record<number, InvestigationDetectorChangeKey>> = {
  [DetectorPriorityLevel.HIGH]: 'highThreshold',
  [DetectorPriorityLevel.MEDIUM]: 'mediumThreshold',
};

type MonitorChangesProps = {
  action: InvestigationUpdateDetectorAction;
  impact: string | null;
  monitor: SourceMonitor | null;
};

export function MonitorChanges({action, impact, monitor}: MonitorChangesProps) {
  const changedKeys = CHANGE_KEYS.filter(key => action.changes[key] !== undefined);
  const subtitle = [
    monitor?.projectSlug,
    changedKeys.includes('environment') ? null : monitor?.environment,
  ].filter(Boolean);
  const measures = [
    changedKeys.includes('aggregate') ? null : monitor?.aggregate,
    changedKeys.includes('query') ? null : monitor?.query,
  ].filter(Boolean);
  const opensAnIssue = getOpensAnIssueDescription(action, monitor);
  const currentAggregate = monitor?.aggregate ?? null;
  const suggestedAggregate =
    typeof action.changes.aggregate === 'string'
      ? action.changes.aggregate
      : currentAggregate;

  return (
    <Container border="primary" radius="md" padding="lg">
      <Stack gap="lg">
        <Stack gap="xs">
          <Flex align="center" gap="sm">
            <IconSiren size="sm" aria-hidden />
            <Text bold size="lg">
              {monitor?.name ?? t('Monitor')}
            </Text>
          </Flex>
          {subtitle.length > 0 ? (
            <Container paddingLeft="xl">
              <Text size="sm" variant="muted">
                {subtitle.join(' • ')}
              </Text>
            </Container>
          ) : null}
        </Stack>
        <Grid columns="max-content minmax(0, 1fr)">
          {measures.length > 0 ? (
            <SettingRow>
              <Text variant="muted">{t('Measures')}</Text>
              <Text monospace>{measures.join(' • ')}</Text>
            </SettingRow>
          ) : null}
          {changedKeys.map(key => {
            const {getLabel, monospace} = CHANGE_FIELDS[key];
            return (
              <SettingRow key={key} changed>
                <Text>{getLabel()}</Text>
                <Text>
                  <VisuallyHidden>{t('Current value:')} </VisuallyHidden>
                  <Text strikethrough variant="muted" monospace={monospace}>
                    {formatChangeValue(
                      key,
                      action.before[key],
                      monitor?.detectionType ?? null,
                      currentAggregate
                    )}
                  </Text>
                  <span aria-hidden> → </span>
                  <VisuallyHidden>, {t('suggested value:')} </VisuallyHidden>
                  <Text bold monospace={monospace}>
                    {formatChangeValue(
                      key,
                      action.changes[key],
                      monitor?.detectionType ?? null,
                      suggestedAggregate
                    )}
                  </Text>
                </Text>
              </SettingRow>
            );
          })}
          {opensAnIssue ? (
            <SettingRow>
              <Text variant="muted">{t('Opens an issue')}</Text>
              <Text>{opensAnIssue}</Text>
            </SettingRow>
          ) : null}
        </Grid>
        {impact ? (
          <Text size="sm" variant="muted">
            {impact}
          </Text>
        ) : null}
      </Stack>
    </Container>
  );
}

function SettingRow({
  changed = false,
  children,
}: {
  children: React.ReactNode;
  changed?: boolean;
}) {
  const Row = changed ? ChangedSettingRow : Grid;
  return (
    <Row column="1 / -1" columns="subgrid" gap="3xl" padding="sm md" radius="sm">
      {children}
    </Row>
  );
}

function getMetricConfig(monitor: SourceMonitor): MetricDetectorConfig | null {
  switch (monitor.detectionType) {
    case 'static':
      return {detectionType: 'static'};
    case 'percent':
      return monitor.comparisonDeltaSeconds === null
        ? null
        : {detectionType: 'percent', comparisonDelta: monitor.comparisonDeltaSeconds};
    default:
      return null;
  }
}

function getOpensAnIssueDescription(
  action: InvestigationUpdateDetectorAction,
  monitor: SourceMonitor | null
) {
  const config = monitor ? getMetricConfig(monitor) : null;
  // The condition would read against the old aggregate.
  if (!monitor?.aggregate || !config || action.changes.aggregate !== undefined) {
    return null;
  }
  const condition = monitor.conditions
    .filter(candidate => candidate.result !== DetectorPriorityLevel.OK)
    .toSorted((a, b) => a.result - b.result)[0];
  const changeKey = condition ? PRIORITY_CHANGE_KEYS[condition.result] : undefined;
  if (!condition || (changeKey && action.changes[changeKey] !== undefined)) {
    return null;
  }
  return getConditionDescription({
    aggregate: monitor.aggregate,
    config,
    condition: {
      id: '',
      type: condition.type,
      comparison: condition.comparison,
      conditionResult: condition.result,
    },
  });
}

function formatChangeValue(
  key: InvestigationDetectorChangeKey,
  value: number | string | null | undefined,
  detectionType: SourceMonitor['detectionType'],
  aggregate: string | null
) {
  if (key === 'query') {
    return value || t('No filter');
  }
  if (key === 'environment') {
    return value || t('All environments');
  }
  if (typeof value !== 'number') {
    return value ?? '—';
  }
  if (key === 'timeWindowSeconds') {
    return getDuration(value);
  }
  if (detectionType === 'percent') {
    const delta = `${percentThresholdAbsoluteToDelta(value)}%`;
    return value >= 100 ? t('%s higher', delta) : t('%s lower', delta);
  }
  const suffix = aggregate ? getStaticDetectorThresholdSuffix(aggregate) : '';
  return `${value}${suffix}`;
}

const ChangedSettingRow = styled(Grid)`
  background: ${p => p.theme.tokens.background.transparent.accent.muted};
`;
