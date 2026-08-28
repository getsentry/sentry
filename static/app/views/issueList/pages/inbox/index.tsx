import {
  type ComponentProps,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useInfiniteQuery, useQuery} from '@tanstack/react-query';
import orderBy from 'lodash/orderBy';
import {parseAsString, useQueryState} from 'nuqs';

import {ActorAvatar, UserAvatar} from '@sentry/scraps/avatar';
import {Badge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Heading, Text} from '@sentry/scraps/text';

import {NotFound} from 'sentry/components/errors/notFound';
import {EventMessage} from 'sentry/components/events/eventMessage';
import {useLinkedPullRequests} from 'sentry/components/group/externalIssuesList/linkedPullRequests';
import {getPullRequestStatusLabel} from 'sentry/components/group/externalIssuesList/pullRequestStatusBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingError} from 'sentry/components/loadingError';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {Placeholder} from 'sentry/components/placeholder';
import {QueryCount} from 'sentry/components/queryCount';
import {SuggestedAvatarStack} from 'sentry/components/suggestedAvatarStack';
import {TimeSince} from 'sentry/components/timeSince';
import {IconArrow, IconChevron, IconPullRequest} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import type {Actor} from 'sentry/types/core';
import {ProgressState, type Group} from 'sentry/types/group';
import type {PullRequestStatus} from 'sentry/types/integrations';
import type {User} from 'sentry/types/user';
import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getAnalyticsDataForGroup, getMessage, getTitle} from 'sentry/utils/events';
import {useMembers} from 'sentry/utils/members/useMembers';
import {parseActorString} from 'sentry/utils/parseActorString';
import {useReplayForCriticalFlow} from 'sentry/utils/replays/useReplayForCriticalFlow';
import {useRouteAnalyticsParams} from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {orgHasIssueInbox} from 'sentry/utils/seer/orgHasIssueInbox';
import {orgHasSeerAccess} from 'sentry/utils/seer/orgHasSeerAccess';
import {useLocation} from 'sentry/utils/useLocation';
import {useMedia} from 'sentry/utils/useMedia';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useResizable} from 'sentry/utils/useResizable';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import {useUser} from 'sentry/utils/useUser';
import {IssueListContainer} from 'sentry/views/issueList';
import {IssuePreview} from 'sentry/views/issueList/pages/inbox/issuePreview/issuePreview';
import {INBOX_AUTOFIX_CATEGORY_FILTER} from 'sentry/views/issueList/pages/inbox/utils';
import {InboxEmptyState} from 'sentry/views/issueList/pages/inboxEmptyState';
import {
  type AssignmentFilter,
  useAssignmentFilter,
} from 'sentry/views/issueList/pages/useAssignmentFilter';
import {useInboxPreviewPrefetch} from 'sentry/views/issueList/pages/useInboxPreviewPrefetch';
import {IssueSortOptions} from 'sentry/views/issueList/utils';
import {getProgressIcon} from 'sentry/views/issueList/utils/progress';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';

const TITLE = t('Inbox');
const ISSUE_LIMIT = 10;
const SELECTED_ISSUE_QUERY_PARAM = 'preview';
const INBOX_SPLIT_SIZE_STORAGE_KEY = 'inbox-split-size';
const INBOX_DEFAULT_SIZE = 480;
const INBOX_MIN_SIZE = 320;
const INBOX_MAX_SIZE = 640;
interface AssignmentCounts {
  all: number;
  me: number;
  my_teams: number;
}

interface AlternateInbox {
  filter: Exclude<AssignmentFilter, 'me'>;
  label: string;
}

const ASSIGNMENT_QUERY_SUFFIXES: Record<AssignmentFilter, string> = {
  me: ' assigned_or_suggested:me',
  my_teams: ' assigned_or_suggested:[me,my_teams]',
  all: '',
};
const ASSIGNMENT_COUNT_QUERY =
  'issue.progress:[fix_proposed,diagnosed,assigned,identified] is:unresolved';
const ALL_ASSIGNMENT_COUNT_QUERY =
  'issue.progress:[fix_proposed,diagnosed,assigned] is:unresolved';
interface InboxSectionContext {
  hasSeer: boolean;
}

interface InboxSectionConfig {
  analyticsKey: 'num_fix_proposed' | 'num_diagnosed' | 'num_assigned' | 'num_fix_applied';
  emptyMessage: string;
  key: string;
  label: string;
  progress: ProgressState;
  query: string | ((assignmentFilter: AssignmentFilter) => string);
  hidden?: (context: InboxSectionContext) => boolean;
}

const SECTIONS: [InboxSectionConfig, ...InboxSectionConfig[]] = [
  {
    analyticsKey: 'num_fix_proposed',
    key: 'fix-proposed',
    label: t('Fix Proposed'),
    query: 'issue.progress:fix_proposed is:unresolved',
    emptyMessage: t('No issues with a proposed fix'),
    progress: ProgressState.FIX_PROPOSED,
  },
  {
    analyticsKey: 'num_diagnosed',
    key: 'diagnosed',
    label: t('Diagnosed'),
    query: 'issue.progress:diagnosed is:unresolved',
    emptyMessage: t('No diagnosed issues'),
    progress: ProgressState.DIAGNOSED,
    hidden: ({hasSeer}) => !hasSeer,
  },
  {
    analyticsKey: 'num_assigned',
    key: 'assigned',
    label: t('Assigned'),
    query: assignmentFilter =>
      assignmentFilter === 'all'
        ? 'issue.progress:assigned is:unresolved'
        : 'issue.progress:[assigned,identified] is:unresolved',
    emptyMessage: t('No assigned issues'),
    progress: ProgressState.ASSIGNED,
    hidden: ({hasSeer}) => !hasSeer,
  },
  {
    analyticsKey: 'num_fix_applied',
    key: 'fix-applied',
    label: t('Fix Applied'),
    query: 'issue.progress:fix_applied is:unresolved',
    emptyMessage: t('No issues with an applied fix'),
    progress: ProgressState.FIX_APPLIED,
  },
];

export default function InboxPage() {
  const organization = useOrganization();
  const hasIssueInbox = orgHasIssueInbox(organization);

  if (!hasIssueInbox || !orgHasSeerAccess(organization)) {
    return <NotFound />;
  }

  return (
    <IssueListContainer title={TITLE}>
      <InboxContent />
    </IssueListContainer>
  );
}

function useSelectFirstLoadedIssue({
  disabled,
  onSelect,
  resetKey,
  sections,
}: {
  disabled: boolean;
  onSelect: (issueId: string) => void;
  resetKey: AssignmentFilter;
  sections: InboxSectionConfig[];
}) {
  const sectionResults = useRef(new Map<string, string | null>());
  const hasFinished = useRef(disabled);
  const previousResetKey = useRef(resetKey);

  if (previousResetKey.current !== resetKey) {
    previousResetKey.current = resetKey;
    sectionResults.current.clear();
    hasFinished.current = disabled;
  }

  return (sectionKey: string, firstIssueId: string | null) => {
    if (hasFinished.current) {
      return;
    }
    if (disabled) {
      hasFinished.current = true;
      return;
    }

    sectionResults.current.set(sectionKey, firstIssueId);
    for (const section of sections) {
      if (!sectionResults.current.has(section.key)) {
        return;
      }

      const issueId = sectionResults.current.get(section.key);
      if (issueId) {
        hasFinished.current = true;
        onSelect(issueId);
        return;
      }
    }
    hasFinished.current = true;
  };
}

// Fetch counts for the assignment filter tabs (my/my teams/all)
function useAssignmentCounts(): AssignmentCounts | null {
  const organization = useOrganization();
  const meQuery = `${ASSIGNMENT_COUNT_QUERY}${ASSIGNMENT_QUERY_SUFFIXES.me}${INBOX_AUTOFIX_CATEGORY_FILTER}`;
  const myTeamsQuery = `${ASSIGNMENT_COUNT_QUERY}${ASSIGNMENT_QUERY_SUFFIXES.my_teams}${INBOX_AUTOFIX_CATEGORY_FILTER}`;
  const allQuery = `${ALL_ASSIGNMENT_COUNT_QUERY}${INBOX_AUTOFIX_CATEGORY_FILTER}`;

  const {data} = useQuery({
    ...apiOptions.as<Record<string, number>>()(
      '/organizations/$organizationIdOrSlug/issues-count/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {query: [meQuery, myTeamsQuery, allQuery]},
        staleTime: 180_000,
      }
    ),
  });

  if (!data) {
    return null;
  }

  return {
    me: data[meQuery] ?? 0,
    my_teams: data[myTeamsQuery] ?? 0,
    all: data[allQuery] ?? 0,
  };
}

function getAlternateInbox(
  assignmentFilter: AssignmentFilter,
  assignmentCounts: AssignmentCounts | null
): AlternateInbox | null {
  if (assignmentFilter === 'me' && assignmentCounts?.my_teams) {
    return {filter: 'my_teams', label: t('View team inbox')};
  }

  if (assignmentFilter !== 'all' && assignmentCounts?.all) {
    return {filter: 'all', label: t('View all inbox')};
  }

  return null;
}

function AssignmentTabs({
  assignmentFilter,
  onChange,
}: {
  assignmentFilter: AssignmentFilter;
  onChange: (filter: AssignmentFilter) => void;
}) {
  const assignmentCounts = useAssignmentCounts();

  useRouteAnalyticsParams(
    assignmentCounts
      ? {
          assignment_filter: assignmentFilter,
          count_me: assignmentCounts.me,
          count_my_teams: assignmentCounts.my_teams,
          count_all: assignmentCounts.all,
        }
      : {
          assignment_filter: assignmentFilter,
        }
  );

  return (
    <SegmentedControl
      aria-label={t('Issue assignee')}
      size="xs"
      value={assignmentFilter}
      onChange={onChange}
    >
      <SegmentedControl.Item key="me" textValue={t('Me')}>
        <Flex as="span" align="center" gap="sm">
          {t('Me')}
          <AssignmentCountBadge count={assignmentCounts?.me} />
        </Flex>
      </SegmentedControl.Item>
      <SegmentedControl.Item key="my_teams" textValue={t('My Teams')}>
        <Flex as="span" align="center" gap="sm">
          {t('My Teams')}
          <AssignmentCountBadge count={assignmentCounts?.my_teams} />
        </Flex>
      </SegmentedControl.Item>
      <SegmentedControl.Item key="all" textValue={t('All')}>
        <Flex as="span" align="center" gap="sm">
          {t('All')}
          <AssignmentCountBadge count={assignmentCounts?.all} />
        </Flex>
      </SegmentedControl.Item>
    </SegmentedControl>
  );
}

function InboxContent() {
  // Temporarily record all replays for the issue inbox
  // Remove this once we roll out to more users
  useReplayForCriticalFlow({flowName: 'issue_inbox', sampleRate: 1});

  const theme = useTheme();
  const isDesktop = useMedia(`(min-width: ${theme.breakpoints.md})`);
  const {layout} = usePrimaryNavigation();
  const isMobile = layout === 'mobile';
  const resizableContainerRef = useRef<HTMLDivElement>(null);
  const organization = useOrganization();
  const hasSeer = orgHasSeerAccess(organization);
  const [assignmentFilter, setAssignmentFilter] = useAssignmentFilter();
  const [selectedIssueId, setSelectedIssueId] = useQueryState(
    SELECTED_ISSUE_QUERY_PARAM,
    parseAsString.withOptions({history: 'replace'})
  );
  const assignmentCounts = useAssignmentCounts();
  const sections = SECTIONS.filter(section => !section.hidden?.({hasSeer}));
  const isInboxEmpty = assignmentCounts?.[assignmentFilter] === 0;
  const alternateInbox = getAlternateInbox(assignmentFilter, assignmentCounts);
  const [storedSize, setStoredSize] = useSyncedLocalStorageState(
    INBOX_SPLIT_SIZE_STORAGE_KEY,
    INBOX_DEFAULT_SIZE
  );
  const {onMouseDown: handleStartResize, size} = useResizable({
    ref: resizableContainerRef,
    initialSize: storedSize,
    minWidth: INBOX_MIN_SIZE,
    maxWidth: INBOX_MAX_SIZE,
    onResizeEnd: setStoredSize,
  });

  const handleInitialSectionResult = useSelectFirstLoadedIssue({
    disabled: !isDesktop || selectedIssueId !== null,
    onSelect: issueId => void setSelectedIssueId(issueId),
    resetKey: assignmentFilter,
    sections,
  });

  const handleAssignmentFilterChange = (filter: AssignmentFilter) => {
    trackAnalytics('issue_inbox.assignment_filter_changed', {
      organization,
      assignment_filter: filter,
    });
    setAssignmentFilter(filter);
  };

  const alternateInboxAction = alternateInbox
    ? {
        label: alternateInbox.label,
        onClick: () => handleAssignmentFilterChange(alternateInbox.filter),
      }
    : undefined;

  return (
    <Stack flex={1} minHeight={0} contain="size" overflow="hidden">
      <Layout.Title>
        {TITLE}
        <PageHeadingQuestionTooltip
          docsUrl="https://docs.sentry.io/product/issues/inbox/"
          title={t(
            'A personalized view of issues relevant to you, organized by how close you are to fixing them.'
          )}
        />
      </Layout.Title>
      <Grid
        flex={1}
        minHeight={0}
        columns={isMobile ? 'minmax(0, 1fr)' : 'max-content minmax(0, 1fr)'}
      >
        <Stack
          ref={isMobile ? undefined : resizableContainerRef}
          as="section"
          aria-label={t('Issue inbox')}
          position="relative"
          width={isMobile ? '100%' : `${size}px`}
          minWidth={0}
          minHeight={0}
          display={selectedIssueId ? {'screen:xs': 'none', 'screen:md': 'flex'} : 'flex'}
          background="primary"
          borderRight="muted"
        >
          <Flex
            as="header"
            align="center"
            justify="between"
            padding="md lg"
            background="secondary"
            borderBottom="muted"
            flexShrink={0}
          >
            <Heading as="h2" size="md">
              {t('Issues')}
            </Heading>
            <AssignmentTabs
              assignmentFilter={assignmentFilter}
              onChange={handleAssignmentFilterChange}
            />
          </Flex>
          <Stack flex={1} minHeight={0} overflowY="auto" overscrollBehavior="contain">
            {sections.map(section => (
              <InboxSection
                key={`${assignmentFilter}:${section.key}`}
                section={section}
                assignmentFilter={assignmentFilter}
                selectedIssueId={selectedIssueId}
                onInitialResult={handleInitialSectionResult}
              />
            ))}
          </Stack>
          <Container
            top="0"
            right="0"
            bottom="0"
            width="8px"
            radius="lg"
            position="absolute"
            display={isMobile ? 'none' : undefined}
          >
            {props => (
              <ResizeHandle
                {...props}
                onMouseDown={handleStartResize}
                onDoubleClick={() => setStoredSize(INBOX_DEFAULT_SIZE)}
                atMinWidth={size === INBOX_MIN_SIZE}
                atMaxWidth={size === INBOX_MAX_SIZE}
              />
            )}
          </Container>
        </Stack>
        <Stack
          as="aside"
          aria-label={t('Issue preview')}
          flex={1}
          minWidth={0}
          minHeight={0}
          overflow="hidden"
          display={selectedIssueId ? 'flex' : {'screen:xs': 'none', 'screen:md': 'flex'}}
        >
          {selectedIssueId && (
            <Container
              display={{'screen:xs': 'block', 'screen:md': 'none'}}
              padding="md"
              borderBottom="muted"
            >
              <Button
                size="xs"
                variant="link"
                icon={<IconArrow direction="left" size="xs" />}
                onClick={() => void setSelectedIssueId(null)}
              >
                {t('Back to inbox')}
              </Button>
            </Container>
          )}
          {selectedIssueId && <IssuePreview groupId={selectedIssueId} />}
          {!selectedIssueId && isInboxEmpty && (
            <InboxEmptyState
              assignmentFilter={assignmentFilter}
              alternateInbox={alternateInboxAction}
            />
          )}
        </Stack>
      </Grid>
    </Stack>
  );
}

function AssignmentCountBadge({count}: {count: number | undefined}) {
  if (count === undefined) {
    return <Placeholder width="24px" height="20px" />;
  }

  return (
    <Badge variant="muted">
      <QueryCount count={count} max={99} hideIfEmpty={false} hideParens />
    </Badge>
  );
}

interface InboxSectionProps {
  assignmentFilter: AssignmentFilter;
  onInitialResult: (sectionKey: string, firstIssueId: string | null) => void;
  section: InboxSectionConfig;
  selectedIssueId: string | null;
}

function InboxSection({
  assignmentFilter,
  onInitialResult,
  section,
  selectedIssueId,
}: InboxSectionProps) {
  const organization = useOrganization();
  const sectionQuery =
    typeof section.query === 'function' ? section.query(assignmentFilter) : section.query;
  const queryResult = useInfiniteQuery({
    ...apiOptions.asInfinite<Group[]>()('/organizations/$organizationIdOrSlug/issues/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        query: `${sectionQuery}${ASSIGNMENT_QUERY_SUFFIXES[assignmentFilter]}${INBOX_AUTOFIX_CATEGORY_FILTER}`,
        sort: IssueSortOptions.PROGRESS,
        limit: ISSUE_LIMIT,
        collapse: ['stats', 'unhandled'],
        expand: ['derivedData', 'owners'],
      },
      staleTime: 0,
    }),
    refetchOnWindowFocus: true,
  });
  const groups = queryResult.data?.pages.flatMap(page => page.json) ?? [];
  const hasIssues = groups.length > 0;
  const [expanded, setExpanded] = useState<boolean>();
  const count = queryResult.data?.pages[0]?.headers['X-Hits'] ?? groups.length;
  const maxCount = queryResult.data?.pages[0]?.headers['X-Max-Hits'];
  useRouteAnalyticsParams({[section.analyticsKey]: count});
  const memberIds = groups.flatMap(group =>
    group.assignedTo?.type === 'user' ? [group.assignedTo.id] : []
  );
  const {data: members = []} = useMembers({ids: memberIds});
  const membersById = new Map(members.map(member => [member.id, member]));
  const hasReportedInitialResult = useRef(false);
  const reportInitialResult = useEffectEvent(() => {
    onInitialResult(section.key, groups[0]?.id ?? null);
  });

  useLayoutEffect(() => {
    if (queryResult.isSuccess && !hasReportedInitialResult.current) {
      hasReportedInitialResult.current = true;
      reportInitialResult();
    }
  }, [queryResult.isSuccess]);

  return (
    <Disclosure
      as="section"
      aria-label={section.label}
      expanded={expanded ?? (!queryResult.isSuccess || hasIssues)}
      onExpandedChange={setExpanded}
      size="sm"
    >
      <StickySectionHeader
        position="sticky"
        top={0}
        width="100%"
        padding="xs xs 0 xs"
        background="primary"
      >
        <Container width="100%" padding="sm" background="secondary" radius="sm">
          <Disclosure.Title
            trailingItems={
              <Badge variant="muted">
                <QueryCount count={count} max={maxCount} hideIfEmpty={false} hideParens />
              </Badge>
            }
          >
            <Flex align="center" gap="sm">
              {getProgressIcon(section.progress)}
              <Heading as="h3" size="md">
                {section.label}
              </Heading>
            </Flex>
          </Disclosure.Title>
        </Container>
      </StickySectionHeader>
      <InboxSectionContent>
        {queryResult.isPending ? (
          <Stack
            aria-label={t('Loading %s issues', section.label)}
            gap="xs"
            padding="0 xs"
          >
            {Array.from({length: ISSUE_LIMIT}).map((_, index) => (
              <Placeholder key={index} height="76px" />
            ))}
          </Stack>
        ) : queryResult.isError && groups.length === 0 ? (
          <Container padding="lg xl">
            <LoadingError
              message={t('Failed to load issues')}
              onRetry={() => void queryResult.refetch()}
            />
          </Container>
        ) : groups.length === 0 ? (
          <Container padding="lg xl">
            <Text as="p" size="sm" variant="muted" align="center">
              {section.emptyMessage}
            </Text>
          </Container>
        ) : (
          <Stack gap="xs">
            {groups.map(group => (
              <Container key={group.id} padding="0 xs">
                <InboxIssueCard
                  assignmentFilter={assignmentFilter}
                  group={group}
                  progressLabel={section.label}
                  selected={selectedIssueId === group.id}
                  showPullRequests={
                    section.progress === ProgressState.FIX_PROPOSED ||
                    section.progress === ProgressState.FIX_APPLIED
                  }
                  assignedUser={
                    group.assignedTo?.type === 'user'
                      ? membersById.get(group.assignedTo.id)
                      : undefined
                  }
                />
              </Container>
            ))}
            {queryResult.hasNextPage && (
              <Flex justify="center" padding="sm xl">
                <Button
                  size="sm"
                  busy={queryResult.isFetchingNextPage}
                  onClick={() => void queryResult.fetchNextPage()}
                  icon={<IconChevron direction="down" />}
                  analyticsEventKey="issue_inbox.show_more_clicked"
                  analyticsEventName="Issue Inbox: Show More Clicked"
                  analyticsParams={{progress: section.progress}}
                >
                  {tn('Show %s more', 'Show %s more', ISSUE_LIMIT)}
                </Button>
              </Flex>
            )}
          </Stack>
        )}
      </InboxSectionContent>
    </Disclosure>
  );
}

function useIssueSuggestedAssignees(group: Group): Actor[] {
  const ownerActors = (group.owners ?? [])
    .map(({owner}) => parseActorString(owner))
    .filter(owner => owner !== undefined);
  const ownerUserIds = ownerActors
    .filter(owner => owner.type === 'user')
    .map(owner => owner.id);
  const ownerTeamIds = ownerActors
    .filter(owner => owner.type === 'team')
    .map(owner => owner.id);
  const {data: ownerUsers = []} = useMembers({ids: ownerUserIds});
  const {teams: matchedTeams} = useTeamsById({ids: ownerTeamIds});
  const ownerTeams = matchedTeams.filter(team => ownerTeamIds.includes(team.id));
  const user = useUser();
  const memberTeamIds = new Set(
    ownerTeams.filter(team => team.isMember).map(team => team.id)
  );
  return orderBy(
    [
      ...ownerUsers.map<Actor>(owner => ({
        id: owner.id,
        name: owner.name,
        email: owner.email,
        type: 'user',
      })),
      ...ownerTeams.map<Actor>(team => ({
        id: team.id,
        name: team.name,
        type: 'team',
      })),
    ],
    [
      // If the current user is in the list, sort it to the top
      owner => owner.type === 'user' && owner.id === user.id,
      // Secondarily, sort teams that the current user is a member of to the top
      owner => owner.type === 'team' && memberTeamIds.has(owner.id),
    ],
    ['desc', 'desc']
  );
}

function getActorLabel(actor: Actor) {
  return actor.type === 'team' ? `#${actor.name}` : actor.name;
}

function InboxIssueCard({
  assignmentFilter,
  assignedUser,
  group,
  progressLabel,
  selected,
  showPullRequests,
}: {
  assignmentFilter: AssignmentFilter;
  group: Group;
  progressLabel: string;
  selected: boolean;
  showPullRequests: boolean;
  assignedUser?: User;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const {title} = getTitle(group);
  const message = getMessage(group);
  const prefetchHoverProps = useInboxPreviewPrefetch(group);
  const suggestedAssignees = useIssueSuggestedAssignees(group);

  return (
    <Container position="relative">
      <IssueCardLink
        {...prefetchHoverProps}
        aria-current={selected ? 'true' : undefined}
        data-selected={selected}
        to={{
          pathname: location.pathname,
          query: {...location.query, [SELECTED_ISSUE_QUERY_PARAM]: group.id},
        }}
        onClick={() =>
          trackAnalytics('issue_inbox.item_clicked', {
            organization,
            ...getAnalyticsDataForGroup(group),
            assignment_filter: assignmentFilter,
            progress: group.derivedData?.progress,
            last_progressed_at: group.derivedData?.lastProgressedAt ?? null,
          })
        }
      >
        <InteractionStateLayer />
        <Grid columns="8px minmax(0, 1fr) max-content" gap="md" align="stretch">
          <Flex align="center">
            {!group.hasSeen && (
              <StatusIndicator
                variant="accent"
                aria-label={t('Unread issue')}
                animationIterationCount={0}
              />
            )}
          </Flex>
          <Stack minWidth={0} gap="xs">
            <Heading as="h4" size="md" ellipsis>
              {title}
            </Heading>
            <EventMessage level={group.level} message={message} type={group.type} />
            <Container height="18px" />
          </Stack>
          <Stack align="end" justify="between">
            {group.derivedData?.lastProgressedAt ? (
              <Text size="sm" variant="muted">
                <TimeSince
                  date={group.derivedData.lastProgressedAt}
                  tooltipPrefix={tct('Changed to [status]', {
                    status: <strong>{progressLabel}</strong>,
                  })}
                  unitStyle="short"
                />
              </Text>
            ) : (
              <div />
            )}
            {group.assignedTo &&
              (group.assignedTo.type === 'user' ? (
                <UserAvatar
                  user={assignedUser ?? group.assignedTo}
                  size={18}
                  hasTooltip
                  tooltip={t('Assigned to: %s', getActorLabel(group.assignedTo))}
                  title={group.assignedTo.name}
                />
              ) : (
                <ActorAvatar
                  actor={group.assignedTo}
                  size={18}
                  hasTooltip
                  tooltip={t('Assigned to: %s', getActorLabel(group.assignedTo))}
                  title={group.assignedTo.name}
                />
              ))}
            {!group.assignedTo && suggestedAssignees.length > 0 && (
              <SuggestedAvatarStack
                size={18}
                owners={suggestedAssignees}
                tooltip={t(
                  'Suggested assignees: %s',
                  suggestedAssignees.map(getActorLabel).join(', ')
                )}
              />
            )}
          </Stack>
        </Grid>
      </IssueCardLink>
      {showPullRequests && <InboxPullRequestBadges group={group} />}
    </Container>
  );
}

const PULL_REQUEST_BADGE_VARIANTS = {
  closed: 'danger',
  draft: 'muted',
  merged: 'info',
  open: 'success',
  unknown: 'muted',
} satisfies Record<PullRequestStatus, ComponentProps<typeof Badge>['variant']>;

function InboxPullRequestBadges({group}: {group: Group}) {
  const {data} = useLinkedPullRequests({group, includeChecksAndReview: false});
  const pullRequests = data?.pullRequests.filter(
    pullRequest => pullRequest.status !== 'closed'
  );

  if (!pullRequests?.length) {
    return null;
  }

  return (
    <PullRequestBadgePositioner>
      <Grid columns="8px minmax(0, 1fr) max-content" gap="md">
        <span />
        <Flex align="center" gap="xs">
          {pullRequests.slice(0, 2).map(pullRequest => (
            <PullRequestBadgeLink
              key={`${pullRequest.repository.id}:${pullRequest.id}`}
              aria-label={t(
                'Pull request #%s, %s',
                pullRequest.id,
                getPullRequestStatusLabel(pullRequest.status)
              )}
              href={pullRequest.externalUrl}
            >
              <Badge variant={PULL_REQUEST_BADGE_VARIANTS[pullRequest.status]}>
                <Flex as="span" align="center" gap="2xs">
                  <IconPullRequest aria-hidden size="xs" />#{pullRequest.id}
                </Flex>
              </Badge>
            </PullRequestBadgeLink>
          ))}
        </Flex>
        <span />
      </Grid>
    </PullRequestBadgePositioner>
  );
}

const InboxSectionContent = styled(Disclosure.Content)`
  padding: ${p => p.theme.space.xs} 0 0 0;
`;

const StickySectionHeader = styled(Container)`
  /* Buttons are position: relative, so load-more paints over a z-index: 1 header. */
  z-index: 2;
`;

const PullRequestBadgePositioner = styled('div')`
  position: absolute;
  right: ${p => p.theme.space.xl};
  bottom: ${p => p.theme.space.lg};
  left: ${p => p.theme.space.xl};
  pointer-events: none;
`;

const PullRequestBadgeLink = styled(ExternalLink)`
  pointer-events: auto;
  text-decoration: none;
`;

const ResizeHandle = styled('div')<{atMaxWidth: boolean; atMinWidth: boolean}>`
  z-index: ${p => p.theme.zIndex.drawer + 2};
  cursor: ${p => (p.atMinWidth ? 'e-resize' : p.atMaxWidth ? 'w-resize' : 'ew-resize')};

  &:hover,
  &:active {
    &::after {
      background: ${p => p.theme.tokens.graphics.accent.vibrant};
    }
  }

  &::after {
    content: '';
    position: absolute;
    right: -2px;
    top: 0;
    bottom: 0;
    width: 4px;
    opacity: 0.8;
    background: transparent;
    transition: background ${p => p.theme.motion.smooth.slow} 0.1s;
  }
`;

const IssueCardLink = styled(Link)`
  display: block;
  position: relative;
  width: 100%;
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  border: 1px solid transparent;
  border-radius: ${p => p.theme.radius.md};
  color: ${p => p.theme.tokens.content.primary};

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }

  &[data-selected='true'] {
    background: ${p =>
      p.theme.tokens.interactive.transparent.accent.selected.background.rest};
    border-color: ${p => p.theme.tokens.border.transparent.accent.muted};
    color: ${p => p.theme.tokens.content.primary};
  }
`;
