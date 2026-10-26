import {IconOpen} from '@sentry/icons/open';
import {IconSeer} from '@sentry/icons/seer';

import {Button, LinkButton} from '@sentry/scraps/button';
import {useDrawerContentContext} from '@sentry/scraps/drawer';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {RevealOnHover} from '@sentry/scraps/revealOnHover';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {Count} from 'sentry/components/count';
import {formatDroppedShare} from 'sentry/components/droppedData/outcomes';
import type {
  AskSeerHandler,
  OutcomeSection,
  ReasonRow,
} from 'sentry/components/droppedData/outcomeSections';
import {reasonDocsUrl, reasonTitle} from 'sentry/components/droppedData/reasonInfo';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';

const COLUMN_WIDTHS = {reason: '1fr', dropped: '96px', share: '88px', actions: '48px'};
const TABLE_COLUMNS: TableColumnConfig[] = Object.entries(COLUMN_WIDTHS).map(
  ([key, width]) => ({key, width})
);
const HEADER_COLUMNS = Object.values(COLUMN_WIDTHS).join(' ');

function ReasonAskSeerButton({
  row,
  onAskSeer,
}: {
  onAskSeer: AskSeerHandler;
  row: ReasonRow;
}) {
  const {onClose: closeDroppedDataDrawer} = useDrawerContentContext();

  return (
    <RevealOnHover.Action>
      <Button
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
    </RevealOnHover.Action>
  );
}

function ReasonDocsLinkButton({href}: {href: string}) {
  return (
    <LinkButton
      size="zero"
      variant="transparent"
      icon={<IconOpen size="xs" />}
      aria-label={t('Go to docs')}
      tooltipProps={{title: t('Go to docs')}}
      href={href}
      external
    />
  );
}

function ReasonTableRow({row, onAskSeer}: {row: ReasonRow; onAskSeer?: AskSeerHandler}) {
  return (
    <RevealOnHover>
      {props => (
        <SimpleTable.Row {...props}>
          <SimpleTable.RowCell padding="md xl" gap="sm">
            <Text size="md">{reasonTitle(row.reason)}</Text>
            <ReasonDocsLinkButton href={reasonDocsUrl(row.reason)} />
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
      )}
    </RevealOnHover>
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
  onAskSeer?: AskSeerHandler;
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
  onAskSeer?: AskSeerHandler;
}) {
  return (
    <Stack gap="md">
      <Grid columns={HEADER_COLUMNS} align="center">
        <Flex align="center" padding="0 xl">
          <Text size="md" bold>
            {section.label}
          </Text>
        </Flex>
        <Flex justify="end" padding="0 xl">
          <Text size="md" variant="muted" tabular>
            <Count value={section.events} />
          </Text>
        </Flex>
        <Flex justify="end" padding="0 xl">
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
  onAskSeer?: AskSeerHandler;
}

export function DroppedDataOutcomeList({
  sections,
  onAskSeer,
}: DroppedDataOutcomeListProps) {
  return (
    <Stack gap="2xl">
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
