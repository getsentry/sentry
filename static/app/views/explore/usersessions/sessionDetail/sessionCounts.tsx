import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {SESSION_DATASETS} from 'sentry/views/explore/usersessions/datasets';

import type {SessionDetail} from './useSessionDetail';

interface Props {
  counts: SessionDetail['counts'];
  isPending: boolean;
  totalEvents: number;
}

/**
 * A handful of headline numbers is a stat-tile row, not a chart — a grouped bar
 * of four counts would encode less and read slower.
 */
export function SessionCounts({counts, totalEvents, isPending}: Props) {
  return (
    <Flex gap="md" wrap="wrap">
      <StatTile label={t('Telemetry')} value={totalEvents} isPending={isPending} />
      {SESSION_DATASETS.map(config => (
        <StatTile
          key={config.key}
          label={config.label}
          value={counts[config.key]}
          isPending={isPending}
        />
      ))}
    </Flex>
  );
}

function StatTile({
  label,
  value,
  isPending,
}: {
  isPending: boolean;
  label: string;
  value: number;
}) {
  return (
    <Tile padding="xl" radius="md" border="primary" background="secondary">
      <Text variant="muted" size="sm">
        {label}
      </Text>
      {/*
        Proportional figures, not tabular: tabular-nums gives every digit the
        width of a zero, which reads loose at display sizes. Tabular belongs in
        the timeline's aligned columns, not here.
      */}
      <Text size="2xl" bold variant={value === 0 && !isPending ? 'muted' : undefined}>
        {isPending ? '—' : formatAbbreviatedNumber(value)}
      </Text>
    </Tile>
  );
}

const Tile = styled(Container)`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space['2xs']};
  min-width: 128px;
`;
