import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';
import {IconChevron} from '@sentry/icons/chevron';

import {Button} from '@sentry/scraps/button';
import {useDrawerContentContext} from '@sentry/scraps/drawer';
import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {DroppedEventsBucket} from 'sentry/components/droppedData/types';
import {
  formatDroppedShare,
  getOutcomeColors,
  outcomeLabel,
  reasonDescription,
  reasonTitle,
} from 'sentry/components/droppedData/utils';
import {TimeSince} from 'sentry/components/timeSince';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {t} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

interface ReasonRow {
  category: string;
  droppedBuckets: number;
  events: number;
  lastSeen: number;
  outcome: string;
  reason: string;
  shareRatio: number;
}

interface CategorySection {
  events: number;
  label: string;
  outcome: string;
  reasons: ReasonRow[];
  shareRatio: number;
}

interface ReasonAggregate {
  buckets: Set<number>;
  category: string;
  events: number;
  lastSeen: number;
}

/**
 * Group dropped events into one section per outcome, each with a row per
 * reason. Shares are computed against total events (accepted + dropped); a
 * reason's `droppedBuckets` counts the distinct time buckets it appears in.
 *
 * `now` clamps `lastSeen`: the most recent bucket is still filling, so its
 * `end` is in the future — without the clamp a reason dropping right now would
 * render as last seen in the future.
 */
export function droppedEventsToCategorySections(
  droppedEvents: DroppedEventsBucket[],
  acceptedEvents: DroppedEventsBucket[],
  now: number = Date.now()
): CategorySection[] {
  const reasonsByOutcome = new Map<string, Map<string, ReasonAggregate>>();
  const eventsByOutcome = new Map<string, number>();
  let totalDroppedEvents = 0;

  for (const event of droppedEvents) {
    const {outcome, reason, category, count, start, end} = event;
    totalDroppedEvents += count;
    eventsByOutcome.set(outcome, (eventsByOutcome.get(outcome) ?? 0) + count);

    const reasons = reasonsByOutcome.get(outcome) ?? new Map<string, ReasonAggregate>();
    const aggregate = reasons.get(reason) ?? {
      category,
      events: 0,
      buckets: new Set<number>(),
      lastSeen: 0,
    };
    aggregate.events += count;
    aggregate.buckets.add(start);
    aggregate.lastSeen = Math.max(aggregate.lastSeen, end);
    reasons.set(reason, aggregate);
    reasonsByOutcome.set(outcome, reasons);
  }

  const totalAcceptedEvents = acceptedEvents.reduce((sum, event) => sum + event.count, 0);
  const totalEvents = totalAcceptedEvents + totalDroppedEvents;
  const share = (events: number) => (totalEvents === 0 ? 0 : events / totalEvents);

  const sections: CategorySection[] = [];
  for (const [outcome, reasons] of reasonsByOutcome) {
    const sectionEvents = eventsByOutcome.get(outcome) ?? 0;

    const reasonRows: ReasonRow[] = [];
    for (const [reason, aggregate] of reasons) {
      reasonRows.push({
        category: aggregate.category,
        outcome,
        reason,
        events: aggregate.events,
        droppedBuckets: aggregate.buckets.size,
        lastSeen: Math.min(aggregate.lastSeen, now),
        shareRatio: share(aggregate.events),
      });
    }
    reasonRows.sort((a, b) => b.events - a.events);

    sections.push({
      outcome,
      label: outcomeLabel(outcome),
      events: sectionEvents,
      shareRatio: share(sectionEvents),
      reasons: reasonRows,
    });
  }
  sections.sort((a, b) => b.events - a.events);

  return sections;
}

const COLUMNS = '1fr 110px 96px 48px';

function categoryInfoForRow(category: string) {
  return Object.values(DATA_CATEGORY_INFO).find(info => info.name === category);
}

function ColorDot({color}: {color: string}) {
  return (
    <Container
      width="12px"
      height="12px"
      radius="full"
      style={{backgroundColor: color}}
    />
  );
}

function CategoryPill({children}: {children: React.ReactNode}) {
  return (
    <Container
      height="16px"
      background="tertiary"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 5px',
        borderRadius: '10px',
      }}
    >
      <Text size="xs" bold>
        {children}
      </Text>
    </Container>
  );
}

function ReasonDescriptionLine({reason, category}: {category: string; reason: string}) {
  const description = reasonDescription(reason, category);
  if (!description) {
    return null;
  }

  return (
    <Text size="sm" variant="muted">
      {description}
    </Text>
  );
}

function FixThisMenu({row, onInvestigate}: {row: ReasonRow; onInvestigate?: () => void}) {
  const organization = useOrganization();
  const {onClose: closeDroppedDataDrawer} = useDrawerContentContext();

  const info = categoryInfoForRow(row.category);

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
  isLast,
  onInvestigate,
}: {
  isLast: boolean;
  row: ReasonRow;
  onInvestigate?: () => void;
}) {
  return (
    <Flex
      align="center"
      justify="between"
      gap="md"
      padding="lg xl"
      background="secondary"
      borderBottom={isLast ? 'none' : 'muted'}
    >
      {/* TODO: full description of the reason will be wired in separately. */}
      <Text size="md">{t('A short description of this drop reason will go here.')}</Text>
      <FixThisMenu row={row} onInvestigate={onInvestigate} />
    </Flex>
  );
}

function ReasonTableRow({
  row,
  totalBuckets,
  isLast,
  onInvestigate,
}: {
  isLast: boolean;
  row: ReasonRow;
  totalBuckets: number;
  onInvestigate?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Fragment>
      <Grid
        columns={COLUMNS}
        align="center"
        borderBottom={expanded || !isLast ? 'muted' : 'none'}
      >
        <Stack gap="xs" padding="md xl">
          <Flex align="baseline" gap="md">
            <Text size="md">{reasonTitle(row.reason)}</Text>
            <Text size="sm" variant="muted">
              <TimeSince date={row.lastSeen} unitStyle="short" disabledAbsoluteTooltip />
            </Text>
          </Flex>
          <ReasonDescriptionLine reason={row.reason} category={row.category} />
        </Stack>
        <Container padding="md xl">
          <Text size="md" variant="muted" tabular>
            {t('%s of %s', row.droppedBuckets, totalBuckets)}
          </Text>
        </Container>
        <Container padding="md xl">
          <Text size="md" variant="muted" tabular>
            {formatDroppedShare(row.shareRatio)}
          </Text>
        </Container>
        <Flex align="center" justify="center">
          <Button
            size="xs"
            variant="transparent"
            icon={<IconChevron direction={expanded ? 'up' : 'down'} size="xs" />}
            aria-label={t('Toggle fix options')}
            aria-expanded={expanded}
            onClick={() => setExpanded(value => !value)}
          />
        </Flex>
      </Grid>
      {expanded && (
        <ReasonExpansion row={row} isLast={isLast} onInvestigate={onInvestigate} />
      )}
    </Fragment>
  );
}

function ReasonTable({
  reasons,
  totalBuckets,
  onInvestigate,
}: {
  reasons: ReasonRow[];
  totalBuckets: number;
  onInvestigate?: () => void;
}) {
  return (
    <Stack radius="md" overflow="hidden" border="muted">
      <Grid columns={COLUMNS} background="secondary">
        <Container padding="lg xl" borderBottom="muted">
          <Text size="sm" variant="muted" uppercase bold>
            {t('Reason')}
          </Text>
        </Container>
        <Container padding="lg xl" borderBottom="muted">
          <Text size="sm" variant="muted" uppercase bold>
            {t('Dropped')}
          </Text>
        </Container>
        <Container padding="lg xl" borderBottom="muted">
          <Text size="sm" variant="muted" uppercase bold>
            {t('Share')}
          </Text>
        </Container>
        <Container padding="lg xl" borderBottom="muted" />
      </Grid>
      {reasons.map((row, index) => (
        <ReasonTableRow
          key={`${row.outcome}:${row.reason}`}
          row={row}
          totalBuckets={totalBuckets}
          isLast={index === reasons.length - 1}
          onInvestigate={onInvestigate}
        />
      ))}
    </Stack>
  );
}

function CategorySectionRow({
  section,
  color,
  totalBuckets,
  onInvestigate,
}: {
  color: string;
  section: CategorySection;
  totalBuckets: number;
  onInvestigate?: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Stack gap="md">
      <Flex
        align="center"
        justify="between"
        width="100%"
        padding="md xl"
        onClick={() => setExpanded(value => !value)}
        style={{cursor: 'pointer'}}
      >
        <Flex align="center" gap="md">
          <ColorDot color={color} />
          <Text size="lg" bold>
            {section.label}
          </Text>
          <CategoryPill>
            {t(
              '%s events • %s',
              formatAbbreviatedNumber(section.events),
              formatDroppedShare(section.shareRatio)
            )}
          </CategoryPill>
        </Flex>
        <IconChevron direction={expanded ? 'up' : 'down'} size="xs" />
      </Flex>
      {expanded && (
        <ReasonTable
          reasons={section.reasons}
          totalBuckets={totalBuckets}
          onInvestigate={onInvestigate}
        />
      )}
    </Stack>
  );
}

interface DroppedDataCategoryListProps {
  acceptedEvents: DroppedEventsBucket[];
  droppedEvents: DroppedEventsBucket[];
  onInvestigate?: () => void;
}

export function DroppedDataCategoryList({
  droppedEvents,
  acceptedEvents,
  onInvestigate,
}: DroppedDataCategoryListProps) {
  const theme = useTheme();
  const sections = droppedEventsToCategorySections(droppedEvents, acceptedEvents);
  const totalBuckets = new Set(
    [...droppedEvents, ...acceptedEvents].map(event => event.start)
  ).size;
  const colors = getOutcomeColors(sections.map(section => section.label).sort(), theme);

  return (
    <Stack gap="md">
      {sections.map(section => (
        <CategorySectionRow
          key={section.outcome}
          section={section}
          color={colors[section.label]!}
          totalBuckets={totalBuckets}
          onInvestigate={onInvestigate}
        />
      ))}
    </Stack>
  );
}
