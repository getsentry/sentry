import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {navigateTo} from 'sentry/actionCreators/navigation';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import EventTagCustomBanner from 'sentry/components/events/eventTags/eventTagCustomBanner';
import {TagFilter} from 'sentry/components/events/eventTags/util';
import Version from 'sentry/components/version';
import VersionHoverCard from 'sentry/components/versionHoverCard';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTag} from 'sentry/types';
import type {Event} from 'sentry/types/event';
import {generateQueryWithTag, isUrl} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';

const MAX_TREE_DEPTH = 4;
const INVALID_BRANCH_REGEX = /\.{2,}/;
const COLUMN_COUNT = 2;

interface TagTree {
  [key: string]: TagTreeContent;
}

export interface TagTreeContent {
  subtree: TagTree;
  value: string;
  // These will be omitted on pseudo tags (see addToTagTree)
  meta?: Record<any, any>;
  originalTag?: EventTag;
}

interface TagTreeColumnData {
  columns: React.ReactNode[];
  runningTotal: number;
  startIndex: number;
}

interface TagTreeRowProps {
  content: TagTreeContent;
  event: Event;
  projectSlug: string;
  tagKey: string;
  isLast?: boolean;
  spacerCount?: number;
}

interface EventTagsTreeProps {
  event: Event;
  projectSlug: string;
  tags: EventTag[];
  meta?: Record<any, any>;
  tagFilter?: TagFilter;
}

function addToTagTree(
  tree: TagTree,
  tag: EventTag,
  meta: Record<any, any>,
  originalTag: EventTag
): TagTree {
  const BRANCH_MATCHES_REGEX = /\./g;
  const branchMatches = tag.key.match(BRANCH_MATCHES_REGEX) ?? [];

  const hasInvalidBranchCount =
    branchMatches.length <= 0 || branchMatches.length > MAX_TREE_DEPTH;
  const hasInvalidBranchSequence = INVALID_BRANCH_REGEX.test(tag.key);

  // Ignore tags with 0, or >4 branches, as well as sequential dots (e.g. 'some..tag')
  if (hasInvalidBranchCount || hasInvalidBranchSequence) {
    tree[tag.key] = {value: tag.value, subtree: {}, meta, originalTag};
    return tree;
  }
  // E.g. 'device.model.version'
  const splitIndex = tag.key.indexOf('.'); // 6
  const trunk = tag.key.slice(0, splitIndex); // 'device'
  const branch = tag.key.slice(splitIndex + 1); // 'model.version'

  if (tree[trunk] === undefined) {
    tree[trunk] = {value: '', subtree: {}};
  }
  // Recurse with a pseudo tag, e.g. 'model', to create nesting structure
  const pseudoTag = {
    key: branch,
    value: tag.value,
  };
  tree[trunk].subtree = addToTagTree(tree[trunk].subtree, pseudoTag, meta, originalTag);
  return tree;
}

function TagTreeRow({
  event,
  content,
  tagKey,
  spacerCount = 0,
  isLast = false,
  projectSlug,
}: TagTreeRowProps) {
  const organization = useOrganization();
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const originalTag = content.originalTag;

  if (!originalTag) {
    return (
      <TreeRow>
        <TreeKeyTrunk spacerCount={spacerCount}>
          {spacerCount > 0 && (
            <Fragment>
              <TreeSpacer spacerCount={spacerCount} isLast={isLast} />
              <TreeBranchIcon />
            </Fragment>
          )}
          <TreeKey>{tagKey}</TreeKey>
        </TreeKeyTrunk>
        <TreeValueTrunk />
      </TreeRow>
    );
  }

  const referrer = 'event-tags-tree';
  const query = generateQueryWithTag({referrer}, originalTag);
  const searchQuery = `?${qs.stringify(query)}`;

  return (
    <TreeRow>
      <TreeKeyTrunk spacerCount={spacerCount}>
        {spacerCount > 0 && (
          <Fragment>
            <TreeSpacer spacerCount={spacerCount} isLast={isLast} />
            <TreeBranchIcon />
          </Fragment>
        )}
        <TreeKey>{tagKey}</TreeKey>
      </TreeKeyTrunk>
      <TreeValueTrunk>
        <TreeValue>
          {originalTag.key === 'release' ? (
            <VersionHoverCard
              organization={organization}
              projectSlug={projectSlug}
              releaseVersion={content.value}
              showUnderline
              underlineColor="linkUnderline"
            >
              <Version version={content.value} truncate />
            </VersionHoverCard>
          ) : (
            content.value
          )}
        </TreeValue>
        <TreeValueDropdown
          preventOverflowOptions={{padding: 4}}
          className={!isVisible ? 'invisible' : ''}
          position="bottom-start"
          dropdownOverlayProps={{onOpenChange: isOpen => setIsVisible(isOpen)}}
          triggerProps={{
            'aria-label': t('Tag Actions Menu'),
            icon: <IconEllipsis />,
            showChevron: false,
            size: 'xs',
            className: 'tag-button',
          }}
          items={[
            {
              key: 'view-events',
              label: t('View other events with this tag value'),
              hidden: !event.groupID,
              onAction: () => {
                navigateTo(
                  `/organizations/${organization.slug}/issues/${event.groupID}/events/${searchQuery}`,
                  router
                );
              },
            },
            {
              key: 'view-issues',
              label: t('View issues with this tag value'),
              onAction: () => {
                navigateTo(
                  `/organizations/${organization.slug}/issues/${searchQuery}`,
                  router
                );
              },
            },
            {
              key: 'release',
              label: t('View this release'),
              hidden: originalTag.key !== 'release',
              onAction: () => {
                navigateTo(
                  `/organizations/${organization.slug}/releases/${encodeURIComponent(
                    content.value
                  )}/`,
                  router
                );
              },
            },
            {
              key: 'transaction',
              label: t('View this transaction'),
              hidden: originalTag.key !== 'transaction',
              onAction: () => {
                const transactionQuery = qs.stringify({
                  project: event.projectID,
                  transaction: content.value,
                  referrer,
                });
                navigateTo(
                  `/organizations/${organization.slug}/performance/summary/?${transactionQuery}`,
                  router
                );
              },
            },
            {
              key: 'replay',
              label: t('View this replay'),
              hidden: originalTag.key !== 'replay_id',
              onAction: () => {
                const replayQuery = qs.stringify({referrer});
                navigateTo(
                  `/replays/${encodeURIComponent(content.value)}/?${replayQuery}`,
                  router
                );
              },
            },
            {
              key: 'external-link',
              label: t('Visit this external link'),
              hidden: !isUrl(content.value),
              onAction: () => {
                openNavigateToExternalLinkModal({linkText: content.value});
              },
            },
          ]}
        />
      </TreeValueTrunk>
    </TreeRow>
  );
}

/**
 * Function to recursively create a flat list of all rows to be rendered for a given TagTree
 * @param props The props for rendering the root of the TagTree
 * @returns A list of TagTreeRow components to be rendered in this tree
 */
function getTagTreeRows({tagKey, content, spacerCount = 0, ...props}: TagTreeRowProps) {
  const subtreeTags = Object.keys(content.subtree);
  const subtreeRows = subtreeTags.reduce((rows, tag, i) => {
    const branchRows = getTagTreeRows({
      ...props,
      tagKey: tag,
      content: content.subtree[tag],
      spacerCount: spacerCount + 1,
      isLast: i === subtreeTags.length - 1,
    });
    return rows.concat(branchRows);
  }, []);

  return [
    <TagTreeRow
      key={`${tagKey}-${spacerCount}`}
      tagKey={tagKey}
      content={content}
      spacerCount={spacerCount}
      {...props}
    />,
    ...subtreeRows,
  ];
}

/**
 * Component to render proportional columns for event tags. The columns will not separate
 * branch tags from their roots, and attempt to be as evenly distributed as possible.
 */
function TagTreeColumns({meta, tags, ...props}: EventTagsTreeProps) {
  const assembledColumns = useMemo(() => {
    // Create the TagTree data structure using all the given tags
    const tagTree = tags.reduce<TagTree>(
      (tree, tag, i) => addToTagTree(tree, tag, meta?.[i], tag),
      {}
    );
    // Create a list of TagTreeRow lists, containing every row to be rendered. They are grouped by
    // root parent so that we do not split up roots/branches when forming columns
    const tagTreeRowGroups: React.ReactNode[][] = Object.entries(tagTree).map(
      ([tagKey, content]) => getTagTreeRows({tagKey, content, ...props})
    );
    // Get the total number of TagTreeRow components to be rendered, and a goal size for each column
    const tagTreeRowTotal = tagTreeRowGroups.reduce(
      (sum, group) => sum + group.length,
      0
    );
    const columnRowGoal = Math.ceil(tagTreeRowTotal / COLUMN_COUNT);

    // Iterate through the row groups, splitting rows into columns when we exceed the goal size
    const data = tagTreeRowGroups.reduce<TagTreeColumnData>(
      ({startIndex, runningTotal, columns}, rowList, index) => {
        // If it's the last entry, create a column with the remaining rows
        if (index === tagTreeRowGroups.length - 1) {
          columns.push(
            <TreeColumn key={columns.length}>
              {tagTreeRowGroups.slice(startIndex)}
            </TreeColumn>
          );
          return {startIndex, runningTotal, columns};
        }
        // If we reach the goal column size, wrap rows in a TreeColumn.
        if (runningTotal >= columnRowGoal) {
          columns.push(
            <TreeColumn key={columns.length}>
              {tagTreeRowGroups.slice(startIndex, index)}
            </TreeColumn>
          );
          runningTotal = 0;
          startIndex = index;
        }
        runningTotal += rowList.length;
        return {startIndex, runningTotal, columns};
      },
      {startIndex: 0, runningTotal: 0, columns: []}
    );
    return data.columns;
  }, [meta, tags, props]);

  return <Fragment>{assembledColumns}</Fragment>;
}

function EventTagsTree(props: EventTagsTreeProps) {
  const hasCustomTagsBanner =
    props.tagFilter === TagFilter.CUSTOM && props.tags.length === 0;
  return (
    <TreeContainer>
      <TreeGarden columnCount={COLUMN_COUNT}>
        <TagTreeColumns {...props} />
      </TreeGarden>
      {hasCustomTagsBanner && <EventTagCustomBanner />}
    </TreeContainer>
  );
}

const TreeContainer = styled('div')`
  margin-top: ${space(1.5)};
`;

const TreeGarden = styled('div')<{columnCount: number}>`
  display: grid;
  gap: 0 ${space(2)};
  grid-template-columns: repeat(${p => p.columnCount}, 1fr);
  align-items: start;
`;

const TreeColumn = styled('div')`
  display: grid;
  grid-template-columns: minmax(auto, 150px) 1fr;
  grid-column-gap: ${space(3)};
  &:not(:first-child) {
    border-left: 1px solid ${p => p.theme.gray200};
    padding-left: ${space(2)};
  }
`;

const TreeRow = styled('div')`
  border-radius: ${space(0.5)};
  padding: 0 0 0 ${space(1)};
  display: grid;
  grid-column: span 2;
  grid-template-columns: subgrid;
  :nth-child(odd) {
    background-color: ${p => p.theme.backgroundSecondary};
  }
  .invisible {
    visibility: hidden;
  }
  &:hover,
  &:active {
    .invisible {
      visibility: visible;
    }
  }
`;

const TreeSpacer = styled('div')<{isLast: boolean; spacerCount: number}>`
  grid-column: span 1;
  /* Allows TreeBranchIcons to appear connected vertically */
  border-right: 1px solid ${p => (!p.isLast ? p.theme.gray200 : 'transparent')};
  margin-right: -1px;
`;

const TreeBranchIcon = styled('div')`
  border: 1px solid ${p => p.theme.gray200};
  border-width: 0 0 1px 1px;
  border-radius: 0 0 0 5px;
  grid-column: span 1;
  margin: 0 ${space(0.5)} 0.5rem 0;
`;

const TreeKeyTrunk = styled('div')<{spacerCount: number}>`
  grid-column: 1 / 2;
  display: grid;
  grid-template-columns: ${p =>
    p.spacerCount > 0 ? `${(p.spacerCount - 1) * 20 + 3}px 1rem 1fr` : '1fr'};
`;

const TreeValueTrunk = styled('div')`
  grid-column: 2 / 3;
  display: grid;
  grid-template-columns: 1fr 25px;
  grid-column-gap: ${space(0.5)};
`;

const TreeValue = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  word-break: break-word;
  grid-column: span 1;
`;

const TreeKey = styled(TreeValue)`
  color: ${p => p.theme.gray300};
`;

const TreeValueDropdown = styled(DropdownMenu)`
  justify-self: end;
  margin: 1px;
  height: 20px;
  .tag-button {
    height: 20px;
    min-height: 20px;
    padding: ${space(0)} ${space(0.75)};
    border-radius: ${space(0.5)};
    z-index: 0;
  }
`;

export default EventTagsTree;
