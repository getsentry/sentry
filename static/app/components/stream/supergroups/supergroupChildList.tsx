import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {IndexedMembersByProject} from 'sentry/actionCreators/members';
import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {
  DEFAULT_STREAM_GROUP_STATS_PERIOD,
  LoadingStreamGroup,
  StreamGroup,
} from 'sentry/components/stream/group';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {IssueSelectionProvider} from 'sentry/views/issueList/issueSelectionContext';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';

const PAGE_SIZE = 25;

const CHILD_COLUMNS: GroupListColumn[] = [
  'graph',
  'firstSeen',
  'lastSeen',
  'event',
  'users',
  'priority',
  'assignee',
];

interface SupergroupChildListProps {
  memberList: IndexedMembersByProject;
  supergroup: SupergroupDetail;
  knownMatchIds?: string[];
  query?: string;
}

export function SupergroupChildList({
  supergroup,
  memberList,
  query: parentQuery,
  knownMatchIds,
}: SupergroupChildListProps) {
  const organization = useOrganization();
  const location = useLocation();
  const [page, setPage] = useState(0);
  const [showUnmatched, setShowUnmatched] = useState(false);

  const {
    query: searchQuery,
    project,
    environment,
    statsPeriod,
    start,
    end,
  } = location.query;
  const query = typeof searchQuery === 'string' ? searchQuery : '';
  const knownSet = new Set(knownMatchIds ?? []);
  // Sort known matches to the front so they appear on page 0
  const groupIds = [...supergroup.group_ids].sort(
    (a, b) => Number(knownSet.has(String(b))) - Number(knownSet.has(String(a)))
  );
  const totalPages = Math.ceil(groupIds.length / PAGE_SIZE);
  const pageGroupIds = groupIds.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const issueIdFilter = `issue.id:[${pageGroupIds.join(',')}]`;

  // Fetch all groups on this page
  const {data: allGroups, isPending: allPending} = useQuery(
    apiOptions.as<Group[]>()('/organizations/$organizationIdOrSlug/issues/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        group: pageGroupIds.map(String),
        project: ALL_ACCESS_PROJECTS,
      },
      staleTime: 30_000,
    })
  );

  // Search with the stream query to find which ones match
  const {data: matchedGroups} = useQuery({
    ...apiOptions.as<Group[]>()('/organizations/$organizationIdOrSlug/issues/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        project,
        environment,
        statsPeriod,
        start,
        end,
        query: `${query} ${issueIdFilter}`,
      },
      staleTime: 30_000,
    }),
    enabled: !!parentQuery,
  });

  if (allPending) {
    return (
      <ChildContainer>
        <TreeList>
          {pageGroupIds.map(id => (
            <TreeRow key={id}>
              <LoadingStreamGroup withChart withColumns={CHILD_COLUMNS} />
            </TreeRow>
          ))}
        </TreeList>
      </ChildContainer>
    );
  }

  const matchedIds = new Set([
    ...(matchedGroups?.map(g => g.id) ?? []),
    ...(knownMatchIds ?? []),
  ]);
  const groupMap = new Map(allGroups?.map(g => [g.id, g]));

  const allResolved = [...pageGroupIds]
    .map(id => groupMap.get(String(id)))
    .filter((g): g is Group => g !== undefined);

  // Split into matched and unmatched when we have known matches
  const hasMatches = matchedIds.size > 0;
  const matched = hasMatches
    ? allResolved.filter(g => matchedIds.has(g.id))
    : allResolved;
  const unmatched = hasMatches ? allResolved.filter(g => !matchedIds.has(g.id)) : [];

  const matchedIds_list = matched.map(g => g.id);
  const unmatchedIds_list = unmatched.map(g => g.id);
  const showPagination = totalPages > 1 && (unmatched.length === 0 || showUnmatched);

  return (
    <ChildContainer>
      <IssueSelectionProvider visibleGroupIds={matchedIds_list}>
        <TreeList>
          <ChildIssueRows
            groups={matched}
            memberList={memberList}
            parentQuery={parentQuery}
          />
        </TreeList>
      </IssueSelectionProvider>
      {showPagination && (
        <Flex justify="end" align="center" gap="sm" padding="sm md">
          <Text size="sm" variant="muted">
            {`${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, groupIds.length)} of ${groupIds.length}`}
          </Text>
          <Flex gap="xs">
            <Button
              size="xs"
              icon={<IconChevron direction="left" />}
              aria-label={t('Previous')}
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            />
            <Button
              size="xs"
              icon={<IconChevron direction="right" />}
              aria-label={t('Next')}
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            />
          </Flex>
        </Flex>
      )}
      {unmatched.length > 0 && (
        <UnmatchedSection
          groups={unmatched}
          memberList={memberList}
          visibleGroupIds={unmatchedIds_list}
          showUnmatched={showUnmatched}
          onToggle={() => setShowUnmatched(prev => !prev)}
        />
      )}
    </ChildContainer>
  );
}

function ChildIssueRows({
  groups,
  memberList,
  parentQuery,
}: {
  groups: Group[];
  memberList: IndexedMembersByProject;
  parentQuery?: string;
}) {
  return (
    <Fragment>
      {groups.map(group => {
        const members = memberList?.[group.project?.slug]
          ? memberList[group.project.slug]
          : undefined;
        return (
          <TreeRow key={group.id}>
            <StreamGroup
              group={group}
              canSelect
              withChart
              withColumns={CHILD_COLUMNS}
              memberList={members}
              statsPeriod={DEFAULT_STREAM_GROUP_STATS_PERIOD}
              source="supergroup-inline"
              query={parentQuery}
              useFilteredStats
            />
          </TreeRow>
        );
      })}
    </Fragment>
  );
}

function UnmatchedSection({
  groups,
  memberList,
  visibleGroupIds,
  showUnmatched,
  onToggle,
}: {
  groups: Group[];
  memberList: IndexedMembersByProject;
  onToggle: () => void;
  showUnmatched: boolean;
  visibleGroupIds: string[];
}) {
  return (
    <Fragment>
      <UnmatchedBanner onClick={onToggle}>
        <InteractionStateLayer />
        <IconChevron direction={showUnmatched ? 'down' : 'right'} size="xs" />
        <Text size="sm" variant="muted">
          {t('%s issues outside current filters', groups.length)}
        </Text>
      </UnmatchedBanner>
      {showUnmatched && (
        <IssueSelectionProvider visibleGroupIds={visibleGroupIds}>
          <TreeList>
            <ChildIssueRows groups={groups} memberList={memberList} />
          </TreeList>
        </IssueSelectionProvider>
      )}
    </Fragment>
  );
}

const ChildContainer = styled('div')`
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  border-left: 1px solid ${p => p.theme.tokens.border.secondary};
  margin-left: ${p => p.theme.space.lg};
  margin-bottom: ${p => p.theme.space.sm};
`;

const TreeList = styled('div')``; /* keep for IssueSelectionProvider grouping */

const TreeRow = styled('div')`
  background: ${p => p.theme.tokens.background.primary};

  &:not(:first-child) {
    border-top: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

const UnmatchedBanner = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  padding: ${p => p.theme.space.md};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  cursor: pointer;
`;
