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
   * Renders every slot as a correctly sized skeleton.
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
   * Rendered as an avatar stack at the head of the stats row.
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

  const peopleLoading = Boolean(people) && (isLoading || Boolean(people?.isLoading));
  // A slot that loads on its own schedule still leaves the region in flux, so
  // it has to count towards `aria-busy` as much as the header's own flag does.
  const isAnyLoading =
    Boolean(isLoading) ||
    peopleLoading ||
    visibleStats.some(({stat}) => Boolean(stat.isLoading));
  const hasPeople = Boolean(people) && (peopleLoading || (people?.users.length ?? 0) > 0);
  const hasStats = visibleStats.length > 0;
  // People and stats share the trailing row, but neither needs the other: the
  // row is there if either one is.
  const hasStatsRow = hasStats || hasPeople;
  const hasSubtitle = Boolean(subtitle);
  const hasMetadata = visibleMetadata.length > 0;
  const hasContext = hasSubtitle || hasMetadata;

  const {columns, areas} = getGridTemplate({hasStatsRow, hasContext});

  const header = (
    <Container
      as="header"
      padding="md xl"
      background="primary"
      borderBottom="primary"
      flexShrink={0}
      // Otherwise the band is simply empty until the data lands, and then
      // silently is not.
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
        {hasStatsRow && (
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
                <EntityHeaderStat {...stat} isLoading={isLoading || stat.isLoading} />
              </Fragment>
            ))}
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
