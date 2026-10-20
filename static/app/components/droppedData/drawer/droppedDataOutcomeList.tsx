import styled from '@emotion/styled';
import {IconSeer} from '@sentry/icons/seer';

import {Button} from '@sentry/scraps/button';
import {useDrawerContentContext} from '@sentry/scraps/drawer';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {Count} from 'sentry/components/count';
import type {
  OutcomeSection,
  ReasonRow,
} from 'sentry/components/droppedData/drawer/outcomeSections';
import {formatDroppedShare, reasonTitle} from 'sentry/components/droppedData/outcomes';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';

const COLUMN_WIDTHS = {reason: '1fr', dropped: '160px', share: '96px', actions: '48px'};
const TABLE_COLUMNS: TableColumnConfig[] = Object.entries(COLUMN_WIDTHS).map(
  ([key, width]) => ({key, width})
);
const HEADER_COLUMNS = Object.values(COLUMN_WIDTHS).join(' ');

function ReasonAskSeerButton({
  row,
  onAskSeer,
}: {
  onAskSeer: (row: ReasonRow) => void;
  row: ReasonRow;
}) {
  const {onClose: closeDroppedDataDrawer} = useDrawerContentContext();

  return (
    <HoverRevealButton
      size="zero"
      variant="primary"
      icon={<IconSeer />}
      aria-label={t('Ask Seer')}
      tooltipProps={{title: t('Ask Seer')}}
      onClick={() => {
        closeDroppedDataDrawer?.();
        onAskSeer(row);
      }}
    />
  );
}

function ReasonTableRow({
  row,
  onAskSeer,
}: {
  row: ReasonRow;
  onAskSeer?: (row: ReasonRow) => void;
}) {
  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell padding="md xl">
        <Text size="md">{reasonTitle(row.reason)}</Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end" padding="md xl">
        <Text size="md" variant="muted" tabular>
          <Count value={row.events} />
        </Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end" padding="md xl">
        <Text size="md" variant="muted" tabular>
          {formatDroppedShare(row.shareRatio)}
        </Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="center" padding="0" overflow="visible">
        {onAskSeer && <ReasonAskSeerButton row={row} onAskSeer={onAskSeer} />}
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

function ColumnHeading({children}: {children: React.ReactNode}) {
  return (
    <Text size="sm" variant="muted" uppercase bold>
      {children}
    </Text>
  );
}

function ReasonTable({
  reasons,
  onAskSeer,
}: {
  reasons: ReasonRow[];
  onAskSeer?: (row: ReasonRow) => void;
}) {
  return (
    <SimpleTable
      columns={TABLE_COLUMNS}
      header={
        <SimpleTable.HeaderRow>
          <SimpleTable.HeaderCell divider={false}>
            <ColumnHeading>{t('Reason')}</ColumnHeading>
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell align="right" divider={false}>
            <ColumnHeading>{t('Dropped')}</ColumnHeading>
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell align="right" divider={false}>
            <ColumnHeading>{t('Share')}</ColumnHeading>
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell aria-label={t('Actions')} />
        </SimpleTable.HeaderRow>
      }
    >
      {reasons.map(row => (
        <ReasonTableRow
          key={`${row.outcome}:${row.reason}`}
          row={row}
          onAskSeer={onAskSeer}
        />
      ))}
    </SimpleTable>
  );
}

function OutcomeSectionRow({
  section,
  onAskSeer,
}: {
  section: OutcomeSection;
  onAskSeer?: (row: ReasonRow) => void;
}) {
  return (
    <Stack gap="md">
      <Grid columns={HEADER_COLUMNS} align="center">
        <Flex align="center" padding="md xl">
          <Text size="lg" bold>
            {section.label}
          </Text>
        </Flex>
        <Flex justify="end" padding="md xl">
          <Text size="md" variant="muted" tabular>
            <Count value={section.events} />
          </Text>
        </Flex>
        <Flex justify="end" padding="md xl">
          <Text size="md" variant="muted" tabular>
            {formatDroppedShare(section.shareRatio)}
          </Text>
        </Flex>
      </Grid>
      <ReasonTable reasons={section.reasons} onAskSeer={onAskSeer} />
    </Stack>
  );
}

interface DroppedDataOutcomeListProps {
  sections: OutcomeSection[];
  onAskSeer?: (row: ReasonRow) => void;
}

export function DroppedDataOutcomeList({
  sections,
  onAskSeer,
}: DroppedDataOutcomeListProps) {
  return (
    <Stack gap="md">
      {sections.map(section => (
        <OutcomeSectionRow
          key={section.outcome}
          section={section}
          onAskSeer={onAskSeer}
        />
      ))}
    </Stack>
  );
}

const HoverRevealButton = styled(Button)`
  opacity: 0;

  [role='row']:hover &,
  [role='row']:focus-within & {
    opacity: 1;
  }
`;
