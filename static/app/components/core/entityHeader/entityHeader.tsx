import {Fragment} from 'react';

import {
  Container,
  type ContainerProps,
  Flex,
  Grid,
  Stack,
  useHasContainerQuery,
} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';

import type {EntityHeaderMetadataItemProps} from './items/entityHeaderMetadataItem';
import {EntityHeaderMetadataItem} from './items/entityHeaderMetadataItem';
import type {EntityHeaderPeopleProps} from './items/entityHeaderPeople';
import {EntityHeaderPeople} from './items/entityHeaderPeople';
import type {EntityHeaderStatProps} from './items/entityHeaderStat';
import {EntityHeaderStat} from './items/entityHeaderStat';
import type {EntityHeaderTitleProps} from './items/entityHeaderTitle';
import {EntityHeaderTitle} from './items/entityHeaderTitle';
import {METADATA_TEXT_HEIGHT, ROW_HEIGHT} from './constants';

export interface EntityHeaderProps {
  /**
   * The entity this page is about.
   */
  title: EntityHeaderTitleProps;
  /**
   * Renders every slot as a correctly sized skeleton. Because the skeleton is
   * produced from the same declarations as the loaded state, the two cannot
   * drift apart.
   */
  isLoading?: boolean;
  /**
   * Supporting facts, rendered as a wrapping row beneath the title.
   *
   * The row is a list, and `label` names it — "Replay properties". Without it a
   * screen reader meets a run of unrelated strings with nothing saying they
   * belong together or to what.
   *
   * `null` items are dropped so callers can inline conditionals.
   */
  metadata?: {
    items: Array<EntityHeaderMetadataItemProps | null>;
    label: string;
  };
  /**
   * People related to this entity — who viewed it, who is participating in it.
   * Rendered as an avatar stack at the head of the stats row, which is where
   * the spec puts it. It gets its own slot rather than being a labelled stat
   * because it has no value, and because it loads on its own schedule —
   * leaving space for it is what stops the row jumping.
   */
  people?: EntityHeaderPeopleProps;
  /**
   * Measurements about the entity. Right-aligned beside the title when there is
   * room; below the metadata row when there is not.
   * `null` entries are dropped so callers can inline conditionals.
   */
  stats?: Array<EntityHeaderStatProps | null>;
  /**
   * A single line of secondary text under the title, e.g. an error message.
   */
  subtitle?: React.ReactNode;
}

/**
 * Computes the grid template from the slots that are actually present.
 *
 * A named grid area with no item still creates a row, and `gap` still applies
 * around it, so a fixed template would leave a hole wherever a slot is omitted.
 *
 * Breakpoints use bare (container) keys, so the header reflows against the
 * width available to it rather than the viewport's.
 *
 * The stats move up beside the title at `lg` (640px). The spec's band edge is
 * 500px, but its own 650px frame is where the two first fit: 294px of title +
 * 8px + 316px of stats is exactly the width available there. Below that the
 * title is squeezed to make room for a stat row whose width the header cannot
 * know in advance.
 */
function getGridTemplate({
  hasStats,
  hasContext,
}: {
  hasContext: boolean;
  hasStats: boolean;
}) {
  if (!hasStats) {
    return {
      columns: 'minmax(0, 1fr)',
      areas: hasContext ? `"title" "context"` : `"title"`,
    } as const;
  }

  return {
    columns: {zero: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) minmax(0, max-content)'},
    areas: hasContext
      ? {
          // Narrow: the stats sit below the metadata, which is also their order
          // in the DOM — reading order and focus order follow the layout.
          zero: `"title" "context" "stats"`,
          // Wide: the stats move up beside the title. Grid placement ignores
          // source order, so this costs the narrow layout nothing.
          lg: `"title stats" "context context"`,
        }
      : {zero: `"title" "stats"`, lg: `"title stats"`},
  } as const;
}

function Divider({height}: {height: ContainerProps['height']}) {
  return (
    // Purely visual: the dividers carry no grouping the layout does not already
    // convey, and a header has five of them. Read out, they are noise between
    // every number and every fact.
    <Container
      height={height}
      display="flex"
      flexShrink={0}
      alignSelf="center"
      aria-hidden
    >
      <Separator orientation="vertical" />
    </Container>
  );
}

/**
 * The band of entity context that sits directly below the TopBar on a detail
 * page: what this thing is, how it is doing, and a few facts about it.
 *
 * Breadcrumbs, the page `h1`, and global actions belong to the TopBar and its
 * slots — this component deliberately does not duplicate them.
 *
 * Every slot except `title` is optional, and the layout adapts to whichever are
 * present.
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

  // Keep the declaration index alongside each item. Keying by position in the
  // filtered array would remount every later item whenever an earlier
  // conditional one appears, closing any menu it happens to own.
  const visibleStats = (stats ?? [])
    .map((stat, index) => ({stat, index}))
    .filter((entry): entry is {index: number; stat: EntityHeaderStatProps} =>
      Boolean(entry.stat)
    );
  const visibleMetadata = (metadata?.items ?? [])
    .map((item, index) => ({item, index}))
    .filter((entry): entry is {index: number; item: EntityHeaderMetadataItemProps} =>
      Boolean(entry.item)
    );

  // The header's own loading counts as these loading, so the avatar skeleton
  // comes up alongside the stat skeletons instead of appearing only once the
  // entity has resolved and its own request can start.
  const peopleLoading = Boolean(people) && (isLoading || Boolean(people?.isLoading));
  const hasPeople = Boolean(people) && (peopleLoading || (people?.users.length ?? 0) > 0);
  const hasStats = visibleStats.length > 0 || hasPeople;
  const hasSubtitle = Boolean(subtitle);
  const hasMetadata = visibleMetadata.length > 0;
  const hasContext = hasSubtitle || hasMetadata;

  const {columns, areas} = getGridTemplate({hasStats, hasContext});

  const header = (
    <Container
      as="header"
      padding="md xl"
      background="primary"
      borderBottom="primary"
      flexShrink={0}
      // Otherwise the band is simply empty until the data lands, and then
      // silently is not.
      aria-busy={isLoading}
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
                minHeight={METADATA_TEXT_HEIGHT}
              >
                {visibleMetadata.map(({item, index}, position) => (
                  <Fragment key={index}>
                    {position > 0 && <Divider height="12px" />}
                    <EntityHeaderMetadataItem {...item} isLoading={isLoading} />
                  </Fragment>
                ))}
              </Flex>
            )}
          </Stack>
        )}
        {hasStats && (
          <Flex
            area="stats"
            align="center"
            gap="md"
            wrap="wrap"
            minHeight={ROW_HEIGHT}
            justifySelf={{zero: 'start', lg: 'end'}}
          >
            {hasPeople && people && (
              <EntityHeaderPeople {...people} isLoading={peopleLoading} />
            )}
            {visibleStats.map(({stat, index}, position) => (
              <Fragment key={index}>
                {(position > 0 || hasPeople) && <Divider height="8px" />}
                <EntityHeaderStat {...stat} isLoading={isLoading} />
              </Fragment>
            ))}
          </Flex>
        )}
      </Grid>
    </Container>
  );

  if (hasParentQueryContainer) {
    // On a routed page the content column is already a query container, and its
    // width is exactly what the layout should react to.
    return header;
  }

  // Standalone — a drawer, a panel, a story — the header establishes its own.
  // This has to be a separate element: `Container` cannot be both an `as`
  // element and a query container, because emotion consumes `as` and renders
  // the DOM node itself, skipping the wiring that sets the container up.
  return (
    <Container containerType="inline-size" width="100%" flexShrink={0}>
      {header}
    </Container>
  );
}
