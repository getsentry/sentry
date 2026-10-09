import {Fragment, useId, useState} from 'react';
import {IconChevron} from '@sentry/icons/chevron';

import {Button} from '@sentry/scraps/button';
import {useDrawerContentContext} from '@sentry/scraps/drawer';
import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {CircleIndicator} from 'sentry/components/circleIndicator';
import type {
  OutcomeSection,
  ReasonRow,
} from 'sentry/components/droppedData/drawer/outcomeSections';
import {
  dataCategoryInfo,
  formatDroppedShare,
  reasonDescription,
  reasonTitle,
  type OutcomeColors,
} from 'sentry/components/droppedData/outcomes';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

const COLUMN_WIDTHS = {reason: '1fr', dropped: '160px', share: '96px', toggle: '48px'};
const TABLE_COLUMNS: TableColumnConfig[] = Object.entries(COLUMN_WIDTHS).map(
  ([key, width]) => ({key, width})
);
const HEADER_COLUMNS = Object.values(COLUMN_WIDTHS).join(' ');

function FixThisMenu({row, onInvestigate}: {row: ReasonRow; onInvestigate?: () => void}) {
  const organization = useOrganization();
  const {onClose: closeDroppedDataDrawer} = useDrawerContentContext();

  const info = dataCategoryInfo(row.category);

  const settingsTo = normalizeUrl(
    `/settings/${organization.slug}/stats/${info ? `?dataCategory=${info.plural}` : ''}`
  );

  // TODO: this will be a dynamic URL once the per-reason docs page
  // fully up-to-date.
  const docsHref = 'https://docs.sentry.io/';

  const items: MenuItemProps[] = [
    ...(onInvestigate
      ? [
          {
            key: 'investigate',
            label: t('Investigate'),
            // TODO: A follow-up PR will seed Seer with per-reason context via
            // `openChatPrompt`.
            onAction: () => {
              closeDroppedDataDrawer?.();
              onInvestigate();
            },
          },
        ]
      : []),
    {
      key: 'project-settings',
      label: t('Project Settings'),
      to: settingsTo,
    },
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
      trigger={(triggerProps, isOpen) => (
        <Button {...triggerProps} variant="primary" size="sm" aria-expanded={isOpen}>
          {t('Fix this')}
        </Button>
      )}
    />
  );
}

function ReasonExpansion({
  row,
  onInvestigate,
}: {
  row: ReasonRow;
  onInvestigate?: () => void;
}) {
  return (
    <SimpleTable.FullWidthRow>
      <Flex
        align="center"
        justify="between"
        gap="md"
        padding="lg xl"
        background="secondary"
      >
        {/* TODO: full description of the reason will be wired in separately. */}
        <Text size="md">
          {t('A short description of this drop reason will go here.')}
        </Text>
        <FixThisMenu row={row} onInvestigate={onInvestigate} />
      </Flex>
    </SimpleTable.FullWidthRow>
  );
}

function ReasonTableRow({
  row,
  onInvestigate,
}: {
  row: ReasonRow;
  onInvestigate?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const description = reasonDescription(row.reason, row.category);

  return (
    <Fragment>
      <SimpleTable.Row>
        <SimpleTable.RowCell direction="column" align="start" gap="xs" padding="md xl">
          <Text size="md">{reasonTitle(row.reason)}</Text>
          {description && (
            <Text size="sm" variant="muted">
              {description}
            </Text>
          )}
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
          <Button
            size="xs"
            variant="transparent"
            icon={<IconChevron direction={expanded ? 'up' : 'down'} size="md" />}
            aria-label={t('Toggle fix options')}
            aria-expanded={expanded}
            onClick={() => setExpanded(value => !value)}
          />
        </SimpleTable.RowCell>
      </SimpleTable.Row>
      {expanded && <ReasonExpansion row={row} onInvestigate={onInvestigate} />}
    </Fragment>
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
  id,
  reasons,
  onInvestigate,
}: {
  id: string;
  reasons: ReasonRow[];
  onInvestigate?: () => void;
}) {
  return (
    <SimpleTable
      id={id}
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
          <SimpleTable.HeaderCell />
        </SimpleTable.HeaderRow>
      }
    >
      {reasons.map(row => (
        <ReasonTableRow
          key={`${row.outcome}:${row.reason}`}
          row={row}
          onInvestigate={onInvestigate}
        />
      ))}
    </SimpleTable>
  );
}

function OutcomeSectionRow({
  section,
  color,
  onInvestigate,
}: {
  color: string | undefined;
  section: OutcomeSection;
  onInvestigate?: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const reasonTableId = useId();
  const toggle = () => setExpanded(value => !value);

  return (
    <Stack gap="md">
      <Grid columns={HEADER_COLUMNS} align="center" onClick={toggle} cursor="pointer">
        <Flex align="center" gap="md" padding="md xl">
          <CircleIndicator color={color} size={12} />
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
        <Flex align="center" justify="center">
          <Button
            size="xs"
            variant="transparent"
            icon={<IconChevron direction={expanded ? 'up' : 'down'} size="md" />}
            aria-label={t('Toggle %s', section.label)}
            aria-expanded={expanded}
            aria-controls={expanded ? reasonTableId : undefined}
            onClick={event => {
              event.stopPropagation();
              toggle();
            }}
          />
        </Flex>
      </Grid>
      {expanded && (
        <ReasonTable
          id={reasonTableId}
          reasons={section.reasons}
          onInvestigate={onInvestigate}
        />
      )}
    </Stack>
  );
}

interface DroppedDataOutcomeListProps {
  colors: OutcomeColors;
  sections: OutcomeSection[];
  onInvestigate?: () => void;
}

export function DroppedDataOutcomeList({
  sections,
  colors,
  onInvestigate,
}: DroppedDataOutcomeListProps) {
  return (
    <Stack gap="md">
      {sections.map(section => (
        <OutcomeSectionRow
          key={section.outcome}
          section={section}
          color={colors[section.outcome]}
          onInvestigate={onInvestigate}
        />
      ))}
    </Stack>
  );
}
