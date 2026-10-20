import {IconEllipsis} from '@sentry/icons/ellipsis';

import {useDrawer, useDrawerContentContext} from '@sentry/scraps/drawer';
import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

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

function ReasonActionsMenu({
  row,
  onTroubleshoot,
}: {
  row: ReasonRow;
  onTroubleshoot?: (row: ReasonRow) => void;
}) {
  const {onClose: closeDroppedDataDrawer} = useDrawerContentContext();
  const {panelRef} = useDrawer();

  // TODO: this will be a dynamic URL once the per-reason docs page
  // fully up-to-date.
  const docsHref = 'https://docs.sentry.io/';

  const items: MenuItemProps[] = [
    ...(onTroubleshoot
      ? [
          {
            key: 'troubleshoot',
            label: t('Troubleshoot'),
            onAction: () => {
              closeDroppedDataDrawer?.();
              onTroubleshoot(row);
            },
          },
        ]
      : []),
    {
      key: 'docs',
      label: t('Go to Docs'),
      externalHref: docsHref,
    },
  ];

  return (
    <DropdownMenu
      items={items}
      position="bottom-end"
      usePortal
      portalContainerRef={panelRef}
      trigger={(triggerProps, isOpen) => (
        <OverlayTrigger.IconButton
          {...triggerProps}
          size="xs"
          variant="transparent"
          icon={<IconEllipsis />}
          aria-label={t('Reason actions')}
          aria-expanded={isOpen}
        />
      )}
    />
  );
}

function ReasonTableRow({
  row,
  onTroubleshoot,
}: {
  row: ReasonRow;
  onTroubleshoot?: (row: ReasonRow) => void;
}) {
  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell padding="md xl">
        <Text size="md">{reasonTitle(row.reason)}</Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end" padding="md xl">
        <Text size="md" variant="muted" tabular>
          {row.events.toLocaleString()}
        </Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end" padding="md xl">
        <Text size="md" variant="muted" tabular>
          {formatDroppedShare(row.shareRatio)}
        </Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="center" padding="0">
        <ReasonActionsMenu row={row} onTroubleshoot={onTroubleshoot} />
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
  onTroubleshoot,
}: {
  reasons: ReasonRow[];
  onTroubleshoot?: (row: ReasonRow) => void;
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
          onTroubleshoot={onTroubleshoot}
        />
      ))}
    </SimpleTable>
  );
}

function OutcomeSectionRow({
  section,
  onTroubleshoot,
}: {
  section: OutcomeSection;
  onTroubleshoot?: (row: ReasonRow) => void;
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
            {section.events.toLocaleString()}
          </Text>
        </Flex>
        <Flex justify="end" padding="md xl">
          <Text size="md" variant="muted" tabular>
            {formatDroppedShare(section.shareRatio)}
          </Text>
        </Flex>
      </Grid>
      <ReasonTable reasons={section.reasons} onTroubleshoot={onTroubleshoot} />
    </Stack>
  );
}

interface DroppedDataOutcomeListProps {
  sections: OutcomeSection[];
  onTroubleshoot?: (row: ReasonRow) => void;
}

export function DroppedDataOutcomeList({
  sections,
  onTroubleshoot,
}: DroppedDataOutcomeListProps) {
  return (
    <Stack gap="md">
      {sections.map(section => (
        <OutcomeSectionRow
          key={section.outcome}
          section={section}
          onTroubleshoot={onTroubleshoot}
        />
      ))}
    </Stack>
  );
}
