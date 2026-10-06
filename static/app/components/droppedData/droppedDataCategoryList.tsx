import {useState} from 'react';
import {useTheme} from '@emotion/react';

import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  formatDroppedShare,
  getOutcomeColors,
  outcomeLabel,
  reasonDescription,
  reasonTitle,
} from 'sentry/components/droppedData/utils';
import {TimeSince} from 'sentry/components/timeSince';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

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
 * Group dropped annotations into one section per outcome, each with a row per
 * reason. Shares are computed against total events (accepted + dropped); a
 * reason's `droppedBuckets` counts the distinct time buckets it appears in.
 *
 * `now` clamps `lastSeen`: the most recent bucket is still filling, so its
 * `end` is in the future — without the clamp a reason dropping right now would
 * render as last seen in the future.
 */
export function annotationsToCategorySections(
  droppedAnnotations: Annotation[],
  acceptedAnnotations: Annotation[],
  now: number = Date.now()
): CategorySection[] {
  const reasonsByOutcome = new Map<string, Map<string, ReasonAggregate>>();
  const eventsByOutcome = new Map<string, number>();
  let totalDroppedEvents = 0;

  for (const annotation of droppedAnnotations) {
    const {outcome, reason, category, eventCount, start, end} = annotation;
    totalDroppedEvents += eventCount;
    eventsByOutcome.set(outcome, (eventsByOutcome.get(outcome) ?? 0) + eventCount);

    const reasons = reasonsByOutcome.get(outcome) ?? new Map<string, ReasonAggregate>();
    const aggregate = reasons.get(reason) ?? {
      category,
      events: 0,
      buckets: new Set<number>(),
      lastSeen: 0,
    };
    aggregate.events += eventCount;
    aggregate.buckets.add(start);
    aggregate.lastSeen = Math.max(aggregate.lastSeen, end);
    reasons.set(reason, aggregate);
    reasonsByOutcome.set(outcome, reasons);
  }

  const totalAcceptedEvents = acceptedAnnotations.reduce(
    (sum, annotation) => sum + annotation.eventCount,
    0
  );
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

const COLUMNS = '1fr 110px 96px';

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

function ReasonCodes({row}: {row: ReasonRow}) {
  return (
    <Grid columns="auto auto" gap="xs md" align="baseline">
      <Text size="sm" variant="muted">
        {t('Reason')}
      </Text>
      <Text size="sm" monospace>
        {row.reason}
      </Text>
      <Text size="sm" variant="muted">
        {t('Outcome')}
      </Text>
      <Text size="sm" monospace>
        {row.outcome}
      </Text>
    </Grid>
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

function ReasonTable({
  reasons,
  totalBuckets,
}: {
  reasons: ReasonRow[];
  totalBuckets: number;
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
      </Grid>
      {reasons.map((row, index) => (
        <Grid
          key={`${row.outcome}:${row.reason}`}
          columns={COLUMNS}
          align="center"
          borderBottom={index === reasons.length - 1 ? 'none' : 'muted'}
        >
          <Stack gap="xs" padding="md xl">
            <Flex align="baseline" gap="md">
              <InfoText size="md" bold title={<ReasonCodes row={row} />}>
                {reasonTitle(row.reason)}
              </InfoText>
              <Text size="sm" variant="muted">
                <TimeSince date={row.lastSeen} unitStyle="short" />
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
        </Grid>
      ))}
    </Stack>
  );
}

function CategorySectionRow({
  section,
  color,
  totalBuckets,
}: {
  color: string;
  section: CategorySection;
  totalBuckets: number;
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
      {expanded && <ReasonTable reasons={section.reasons} totalBuckets={totalBuckets} />}
    </Stack>
  );
}

interface DroppedDataCategoryListProps {
  acceptedAnnotations: Annotation[];
  droppedAnnotations: Annotation[];
}

export function DroppedDataCategoryList({
  droppedAnnotations,
  acceptedAnnotations,
}: DroppedDataCategoryListProps) {
  const theme = useTheme();
  const sections = annotationsToCategorySections(droppedAnnotations, acceptedAnnotations);
  const totalBuckets = new Set(
    [...droppedAnnotations, ...acceptedAnnotations].map(a => a.start)
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
        />
      ))}
    </Stack>
  );
}
