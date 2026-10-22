import styled from '@emotion/styled';
import {VisuallyHidden} from '@react-aria/visually-hidden';

import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {getDuration} from 'sentry/utils/duration/getDuration';
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

type MonitorChangesProps = {
  action: InvestigationUpdateDetectorAction;
  impact: string | null;
};

export function MonitorChanges({action, impact}: MonitorChangesProps) {
  const changedKeys = CHANGE_KEYS.filter(key => action.changes[key] !== undefined);

  return (
    <Container border="primary" radius="md" padding="lg">
      <Stack gap="lg">
        <Grid columns="max-content minmax(0, 1fr)">
          {changedKeys.map(key => {
            const {getLabel, monospace} = CHANGE_FIELDS[key];
            return (
              <SettingRow key={key}>
                <Text>{getLabel()}</Text>
                <Text>
                  <VisuallyHidden>{t('Current value:')} </VisuallyHidden>
                  <Text strikethrough variant="muted" monospace={monospace}>
                    {formatChangeValue(key, action.before[key])}
                  </Text>
                  <span aria-hidden> → </span>
                  <VisuallyHidden>, {t('suggested value:')} </VisuallyHidden>
                  <Text bold monospace={monospace}>
                    {formatChangeValue(key, action.changes[key])}
                  </Text>
                </Text>
              </SettingRow>
            );
          })}
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

function SettingRow({children}: {children: React.ReactNode}) {
  return (
    <ChangedSettingRow
      column="1 / -1"
      columns="subgrid"
      gap="3xl"
      padding="sm md"
      radius="sm"
    >
      {children}
    </ChangedSettingRow>
  );
}

function formatChangeValue(
  key: InvestigationDetectorChangeKey,
  value: number | string | null | undefined
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
  return String(value);
}

const ChangedSettingRow = styled(Grid)`
  background: ${p => p.theme.tokens.background.transparent.accent.muted};
`;
