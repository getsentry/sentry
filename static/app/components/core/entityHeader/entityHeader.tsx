import {Container, Flex, Grid, Stack, useHasContainerQuery} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';

import type {
  EntityHeaderMetadataItemProps,
  ResolvedMetadataItem,
} from './items/entityHeaderMetadataItem';
import {
  EntityHeaderMetadataItem,
  EntityHeaderMetadataItemSkeleton,
  MetadataDivider,
  resolveMetadataItem,
} from './items/entityHeaderMetadataItem';
import type {EntityHeaderPeopleProps} from './items/entityHeaderPeople';
import {EntityHeaderPeople} from './items/entityHeaderPeople';
import type {EntityHeaderStatProps} from './items/entityHeaderStat';
import {EntityHeaderStat} from './items/entityHeaderStat';
import type {EntityHeaderTitleProps} from './items/entityHeaderTitle';
import {EntityHeaderTitle} from './items/entityHeaderTitle';
import {METADATA_ROW_HEIGHT, METADATA_TEXT_HEIGHT, ROW_HEIGHT} from './constants';

export interface EntityHeaderProps {
  /**
   * The entity this page is about.
   */
  title: EntityHeaderTitleProps;
  /**
   * Renders every slot as a correctly sized skeleton.
   */
  isLoading?: boolean;
  /**
   * Supporting facts, rendered as a wrapping row beneath the title.
   *
   * The row is a list named by `label`, such as "Replay properties". Without a
   * label, a screen reader reads the values with nothing saying what they
   * belong to.
   *
   * `null` items are dropped so callers can inline conditionals.
   */
  metadata?: {items: Array<EntityHeaderMetadataItemProps | null>; label: string};
  /**
   * People related to this entity, such as who viewed it or who participates
   * in it. Rendered as an avatar stack at the start of the stats row.
   */
  people?: EntityHeaderPeopleProps;
  /**
   * Measurements about the entity. Right-aligned beside the title when there is
   * room, and below the metadata row when there is not.
   *
   * The row is a list named by `label`, such as "Replay stats". Without a
   * label, a screen reader reads the numbers with nothing saying what they
   * count.
   *
   * `null` items are dropped so callers can inline conditionals.
   */
  stats?: {items: Array<EntityHeaderStatProps | null>; label: string};
  /**
   * A single line of secondary text under the title, such as an error message.
   *
   * Unlike `metadata`, this row renders only when it has content. A subtitle
   * that has not loaded looks the same as one that was never passed, so a
   * subtitle that arrives after the first paint adds its line then.
   */
  subtitle?: React.ReactNode;
}

function getGridTemplate({
  hasStatsRow,
  hasContext,
}: {
  hasContext: boolean;
  hasStatsRow: boolean;
}) {
  if (!hasStatsRow) {
    return {
      columns: 'minmax(0, 1fr)',
      areas: hasContext ? `"title" "context"` : `"title"`,
    } as const;
  }

  return {
    columns: {zero: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) minmax(0, max-content)'},
    areas: hasContext
      ? {
          zero: `"title" "context" "stats"`,
          // One source order cannot match both templates, so it follows the
          // stacked one, where reading order and visual order agree.
          lg: `"title stats" "context context"`,
        }
      : {zero: `"title" "stats"`, lg: `"title stats"`},
  } as const;
}

/**
 * The header directly below the TopBar on a detail page. It shows the entity's
 * title, plus an optional subtitle, stats, people and metadata.
 *
 * Breadcrumbs, the page `h1` and global actions belong to the TopBar and its
 * slots, so this component does not render them.
 *
 * Every slot except `title` is optional, and the layout is built from the
 * slots that are passed.
 */
export function EntityHeader({
  isLoading,
  metadata,
  stats,
  people,
  subtitle,
  title,
}: EntityHeaderProps) {
  const hasParentQueryContainer = useHasContainerQuery();

  const visibleStats = (stats?.items ?? [])
    .map((stat, index) => ({stat, index}))
    .filter((entry): entry is {index: number; stat: EntityHeaderStatProps} =>
      Boolean(entry.stat)
    );

  const peopleLoading = Boolean(people) && (isLoading || Boolean(people?.isLoading));
  // A slot's own `isLoading` counts towards `aria-busy` the same as the
  // header's `isLoading`.
  const isAnyLoading =
    Boolean(isLoading) ||
    peopleLoading ||
    visibleStats.some(({stat}) => Boolean(stat.isLoading));
  const hasPeople = Boolean(people) && (peopleLoading || (people?.users.length ?? 0) > 0);
  const hasStats = visibleStats.length > 0;
  // People and stats share the trailing row. The row renders if either one is
  // present.
  const hasStatsRow = hasStats || hasPeople;
  const hasSubtitle = Boolean(subtitle);
  // While loading, every declared item gets a skeleton, `null` items included,
  // and no item is resolved, since a value is often empty until its data
  // arrives. A caller whose items all wait on one request has none of them on
  // the first paint. Basing the row on resolved items would add the row, and
  // push the page below it down, only when the data arrives. Once loaded, each
  // item is resolved here once, so an item that renders nothing is never
  // treated as the row's last item.
  const metadataSlots: Array<{
    hasGraphic: boolean;
    index: number;
    item: ResolvedMetadataItem | null;
  }> = isLoading
    ? (metadata?.items ?? []).map((item, index) => ({
        index,
        item: null,
        hasGraphic: Boolean(item?.leadingGraphic),
      }))
    : (metadata?.items ?? []).flatMap((declared, index) => {
        const item = declared ? resolveMetadataItem(declared) : null;
        return item ? [{index, item, hasGraphic: false}] : [];
      });
  const hasMetadata = Boolean(metadata) && (isLoading || metadataSlots.length > 0);
  const hasContext = hasSubtitle || hasMetadata;

  const {columns, areas} = getGridTemplate({hasStatsRow, hasContext});

  const header = (
    <Container
      as="header"
      padding="md xl"
      background="primary"
      borderBottom="primary"
      flexShrink={0}
      // Without it, screen readers get no signal that content is still
      // loading.
      aria-busy={isAnyLoading}
    >
      <Grid columns={columns} areas={areas} gap="md" align="start">
        <Container area="title" minWidth={0}>
          <EntityHeaderTitle {...title} isLoading={isLoading} />
        </Container>

        {hasContext && (
          <Stack area="context" minWidth={0}>
            {hasSubtitle && (
              <Flex align="center" minWidth={0} minHeight={METADATA_TEXT_HEIGHT}>
                {isLoading ? (
                  <Placeholder width="320px" height={METADATA_TEXT_HEIGHT} />
                ) : (
                  <Text size="md" density="comfortable" ellipsis>
                    {subtitle}
                  </Text>
                )}
              </Flex>
            )}

            {hasMetadata && metadata && (
              <Flex
                role="list"
                aria-label={metadata.label}
                align="center"
                gap="md"
                wrap="wrap"
                minWidth={0}
                minHeight={METADATA_ROW_HEIGHT}
              >
                {metadataSlots.map(({item, index, hasGraphic}, position) => {
                  const isLast = position === metadataSlots.length - 1;
                  const trailing = isLast ? null : <MetadataDivider />;
                  return item ? (
                    <EntityHeaderMetadataItem key={index} {...item} trailing={trailing} />
                  ) : (
                    <EntityHeaderMetadataItemSkeleton
                      key={index}
                      hasGraphic={hasGraphic}
                      trailing={trailing}
                    />
                  );
                })}
              </Flex>
            )}
          </Stack>
        )}
        {hasStatsRow && (
          <Flex
            area="stats"
            align="center"
            gap="xl"
            wrap="wrap"
            minHeight={ROW_HEIGHT}
            justifySelf={{zero: 'start', lg: 'end'}}
          >
            {hasPeople && people && (
              <EntityHeaderPeople {...people} isLoading={peopleLoading} />
            )}
            {/*
              People sit beside the stats list, not inside it, so the list
              named by `stats.label` holds only stats.
            */}
            {hasStats && stats && (
              <Flex
                as="ul"
                role="list"
                aria-label={stats.label}
                align="center"
                gap="xl"
                wrap="wrap"
                margin="0"
                padding="0"
                minHeight={ROW_HEIGHT}
              >
                {visibleStats.map(({stat, index}) => (
                  <EntityHeaderStat
                    key={index}
                    {...stat}
                    isLoading={isLoading || stat.isLoading}
                  />
                ))}
              </Flex>
            )}
          </Flex>
        )}
      </Grid>
    </Container>
  );

  if (hasParentQueryContainer) {
    return header;
  }

  return (
    <Container containerType="inline-size" width="100%" flexShrink={0}>
      {header}
    </Container>
  );
}
