import styled from '@emotion/styled';
import {VisuallyHidden} from '@react-aria/visually-hidden';
import {IconCheckmark} from '@sentry/icons/checkmark';
import {IconSiren} from '@sentry/icons/siren';

import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {DetectorPriorityLevel} from 'sentry/types/workflowEngine/dataConditions';
import type {MetricDetectorConfig} from 'sentry/types/workflowEngine/detectors';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {getConditionDescription} from 'sentry/views/detectors/components/details/metric/detect';
import {getStaticDetectorThresholdSuffix} from 'sentry/views/detectors/utils/metricDetectorSuffix';
import {percentThresholdAbsoluteToDelta} from 'sentry/views/detectors/utils/percentThreshold';
import type {InvestigationDetectorValues} from 'sentry/views/investigations/api';
import type {SourceMonitor} from 'sentry/views/investigations/source';
import type {
  InvestigationDetectorChangeKey,
  InvestigationUpdateDetectorAction,
} from 'sentry/views/investigations/types';

type ChangeField = {
  getActivityLabel: () => string;
  getLabel: () => string;
  monospace: boolean;
};

const CHANGE_FIELDS = {
  query: {
    getLabel: () => t('Query'),
    getActivityLabel: () => t('query'),
    monospace: true,
  },
  aggregate: {
    getLabel: () => t('Aggregate'),
    getActivityLabel: () => t('aggregate'),
    monospace: true,
  },
  environment: {
    getLabel: () => t('Environment'),
    getActivityLabel: () => t('environment'),
    monospace: false,
  },
  timeWindowSeconds: {
    getLabel: () => t('Interval'),
    getActivityLabel: () => t('interval'),
    monospace: false,
  },
  highThreshold: {
    getLabel: () => t('High threshold'),
    getActivityLabel: () => t('threshold'),
    monospace: false,
  },
  mediumThreshold: {
    getLabel: () => t('Medium threshold'),
    getActivityLabel: () => t('threshold'),
    monospace: false,
  },
  resolutionThreshold: {
    getLabel: () => t('Resolution threshold'),
    getActivityLabel: () => t('threshold'),
    monospace: false,
  },
} satisfies Record<InvestigationDetectorChangeKey, ChangeField>;

const CHANGE_KEYS = Object.keys(CHANGE_FIELDS) as InvestigationDetectorChangeKey[];

const PRIORITY_CHANGE_KEYS: Partial<Record<number, InvestigationDetectorChangeKey>> = {
  [DetectorPriorityLevel.HIGH]: 'highThreshold',
  [DetectorPriorityLevel.MEDIUM]: 'mediumThreshold',
};

export function getChangedFieldLabels(fields: string[]) {
  const labels = CHANGE_KEYS.filter(key => fields.includes(key)).map(key =>
    CHANGE_FIELDS[key].getActivityLabel()
  );
  return [...new Set(labels)];
}

type MonitorChangesProps = {
  action: InvestigationUpdateDetectorAction;
  applied: boolean;
  impact: string | null;
  monitor: SourceMonitor | null;
  name: string | null;
  current?: InvestigationDetectorValues;
};

export function MonitorChanges({
  action,
  applied,
  current,
  impact,
  monitor,
  name,
}: MonitorChangesProps) {
  const changedKeys = CHANGE_KEYS.filter(key => action.changes[key] !== undefined);
  const shownKeys = current
    ? CHANGE_KEYS.filter(key => current[key] !== undefined)
    : changedKeys;
  const subtitle = [
    monitor?.projectSlug,
    shownKeys.includes('environment') ? null : monitor?.environment,
  ].filter(Boolean);
  const measures = [
    shownKeys.includes('aggregate') ? null : monitor?.aggregate,
    shownKeys.includes('query') ? null : monitor?.query,
  ].filter(Boolean);
  const opensAnIssue = getOpensAnIssueDescription(action, monitor);
  const currentAggregate = monitor?.aggregate ?? null;
  const suggestedAggregate =
    typeof action.changes.aggregate === 'string'
      ? action.changes.aggregate
      : currentAggregate;
  const nowAggregate =
    typeof current?.aggregate === 'string' ? current.aggregate : currentAggregate;

  return (
    <Container border="primary" radius="md" padding="lg">
      <Stack gap="lg">
        <Flex justify="between" align="start" gap="md">
          <Stack gap="xs">
            <Flex align="center" gap="sm">
              <IconSiren size="sm" aria-hidden />
              <Text bold size="lg">
                {name ?? t('Monitor')}
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
          {applied ? (
            <Tag variant="success" icon={<IconCheckmark />}>
              {t('Applied')}
            </Tag>
          ) : null}
        </Flex>
        <Grid columns="max-content minmax(0, 1fr)">
          {measures.length > 0 ? (
            <SettingRow>
              <Text variant="muted">{t('Measures')}</Text>
              <Text monospace>{measures.join(' • ')}</Text>
            </SettingRow>
          ) : null}
          {shownKeys.map(key => {
            const {getLabel, monospace} = CHANGE_FIELDS[key];
            const before = formatChangeValue(
              key,
              action.before[key],
              monitor?.detectionType,
              currentAggregate
            );
            const after = formatChangeValue(
              key,
              action.changes[key],
              monitor?.detectionType,
              suggestedAggregate
            );
            return (
              <SettingRow key={key} changed>
                <Text>{getLabel()}</Text>
                {applied ? (
                  <Text>
                    <Text bold monospace={monospace}>
                      {after}
                    </Text>{' '}
                    <Text size="sm" variant="muted" monospace={monospace}>
                      {t('was %s', before)}
                    </Text>
                  </Text>
                ) : current ? (
                  <Text>
                    <Text variant="muted" monospace={monospace}>
                      {t('When suggested: %s', before)}
                    </Text>
                    {' · '}
                    <Text bold monospace={monospace}>
                      {t(
                        'Now: %s',
                        formatChangeValue(
                          key,
                          current[key],
                          monitor?.detectionType,
                          nowAggregate
                        )
                      )}
                    </Text>
                  </Text>
                ) : (
                  <Text>
                    <VisuallyHidden>{t('Current value:')} </VisuallyHidden>
                    <Text strikethrough variant="muted" monospace={monospace}>
                      {before}
                    </Text>
                    <span aria-hidden> → </span>
                    <VisuallyHidden>, {t('suggested value:')} </VisuallyHidden>
                    <Text bold monospace={monospace}>
                      {after}
                    </Text>
                  </Text>
                )}
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
  if (
    !condition ||
    typeof condition.comparison !== 'number' ||
    (changeKey && action.changes[changeKey] !== undefined)
  ) {
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
  detectionType: SourceMonitor['detectionType'] | undefined,
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
