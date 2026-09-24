import {useState} from 'react';
import {useTheme} from '@emotion/react';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {TimeSince} from 'sentry/components/timeSince';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

import {
  annotationsToCategorySections,
  type CategorySection,
  type ReasonRow,
} from './droppedDataCategories';
import {getOutcomeColors} from './droppedDataChart';

// Shares run tiny (a reason can be a sliver of all traffic), so keep two
// decimals and floor the display at 0.01% rather than rounding to 0%.
const SHARE_MIN_VALUE = 0.0001;

function formatShare(ratio: number): string {
  return formatPercentage(ratio, 2, {minimumValue: SHARE_MIN_VALUE});
}

const COLUMNS = '1fr 84px 84px';

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

function MetaItem({
  children,
  monospace,
}: {
  children: React.ReactNode;
  monospace?: boolean;
}) {
  return (
    <Text size="sm" variant="muted" monospace={monospace} underline="dotted">
      {children}
    </Text>
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
            <Text size="md" bold>
              {row.reason}
            </Text>
            <Flex gap="md">
              <MetaItem>
                <TimeSince date={row.lastSeen} unitStyle="short" />
              </MetaItem>
              <MetaItem monospace>{row.reason}</MetaItem>
              <MetaItem monospace>{row.outcome}</MetaItem>
            </Flex>
          </Stack>
          <Container padding="md xl">
            <Text size="md" variant="muted" tabular>
              {t('%s of %s', row.droppedBuckets, totalBuckets)}
            </Text>
          </Container>
          <Container padding="md xl">
            <Text size="md" variant="muted" tabular>
              {formatShare(row.shareRatio)}
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
              formatShare(section.shareRatio)
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
  acceptedDataAnnotations: Annotation[];
  droppedDataAnnotations: Annotation[];
}

export function DroppedDataCategoryList({
  droppedDataAnnotations,
  acceptedDataAnnotations,
}: DroppedDataCategoryListProps) {
  const theme = useTheme();
  const sections = annotationsToCategorySections(
    droppedDataAnnotations,
    acceptedDataAnnotations
  );
  // Dropped and accepted share the same buckets, so the distinct bucket count
  // across both is the series length used for each reason's "N of total".
  const totalBuckets = new Set(
    [...droppedDataAnnotations, ...acceptedDataAnnotations].map(a => a.start)
  ).size;
  // Sort the labels the same way the chart does (alphabetical) before assigning
  // colors, so a category's dot here matches its bar color in the chart even
  // though the sections themselves are displayed by event count.
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
