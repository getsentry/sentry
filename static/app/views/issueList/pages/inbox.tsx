import styled from '@emotion/styled';
import {useInfiniteQuery} from '@tanstack/react-query';
import {parseAsString, parseAsStringLiteral, useQueryState} from 'nuqs';

import {ActorAvatar, ProjectAvatar, UserAvatar} from '@sentry/scraps/avatar';
import {Badge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Heading, Text} from '@sentry/scraps/text';

import {NotFound} from 'sentry/components/errors/notFound';
import {EventMessage} from 'sentry/components/events/eventMessage';
import * as Layout from 'sentry/components/layouts/thirds';
import {LoadingError} from 'sentry/components/loadingError';
import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Placeholder} from 'sentry/components/placeholder';
import {IconArrow, IconChevron} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {ProgressState, type Group} from 'sentry/types/group';
import type {User} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getUtcDateString} from 'sentry/utils/dates';
import {getMessage, getTitle} from 'sentry/utils/events';
import {useMembers} from 'sentry/utils/members/useMembers';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {IssuePreview} from 'sentry/views/issueDetails/issuePreview/issuePreview';
import {IssueListContainer} from 'sentry/views/issueList';
import {IssueSeenTimes} from 'sentry/views/issueList/pages/issueSeenTimes';
import {IssueSortOptions} from 'sentry/views/issueList/utils';
import {getProgressIcon} from 'sentry/views/issueList/utils/progress';

const TITLE = t('Inbox');
const ISSUE_LIMIT = 5;
const SELECTED_ISSUE_QUERY_PARAM = 'preview';
const ASSIGNMENT_QUERY_PARAM = 'assignment';
const ASSIGNMENT_FILTERS = ['me', 'my_teams'] as const;
type AssignmentFilter = (typeof ASSIGNMENT_FILTERS)[number];

interface InboxSectionConfig {
  defaultExpanded: boolean;
  emptyMessage: string;
  key: string;
  label: string;
  progress: ProgressState;
  query: string;
}

const SECTIONS: InboxSectionConfig[] = [
  {
    key: 'fix-proposed',
    label: t('Fix Proposed'),
    query: 'issue.progress:fix_proposed',
    emptyMessage: t('No issues with a proposed fix'),
    progress: ProgressState.FIX_PROPOSED,
    defaultExpanded: true,
  },
  {
    key: 'diagnosed',
    label: t('Diagnosed'),
    query: 'issue.progress:diagnosed',
    emptyMessage: t('No diagnosed issues'),
    progress: ProgressState.DIAGNOSED,
    defaultExpanded: true,
  },
  {
    key: 'assigned',
    label: t('Assigned'),
    query: 'issue.progress:assigned',
    emptyMessage: t('No assigned issues'),
    progress: ProgressState.ASSIGNED,
    defaultExpanded: false,
  },
];

export default function InboxPage() {
  const organization = useOrganization();

  if (!organization.features.includes('issue-stream-progress-ui')) {
    return <NotFound />;
  }

  return (
    <IssueListContainer title={TITLE}>
      <PageFiltersContainer>
        <NoProjectMessage organization={organization}>
          <InboxContent />
        </NoProjectMessage>
      </PageFiltersContainer>
    </IssueListContainer>
  );
}

function InboxContent() {
  const {selection, isReady} = usePageFilters();
  const [assignmentFilter, setAssignmentFilter] = useQueryState(
    ASSIGNMENT_QUERY_PARAM,
    parseAsStringLiteral(ASSIGNMENT_FILTERS)
      .withDefault('me')
      .withOptions({history: 'replace'})
  );
  const [selectedIssueId, setSelectedIssueId] = useQueryState(
    SELECTED_ISSUE_QUERY_PARAM,
    parseAsString.withOptions({history: 'replace'})
  );

  return (
    <Stack flex={1} minHeight={0} contain="size" overflow="hidden">
      <Layout.Title>{TITLE}</Layout.Title>
      <Container padding="lg xl" borderBottom="muted">
        <PageFilterBar condensed>
          <ProjectPageFilter resetParamsOnChange={[SELECTED_ISSUE_QUERY_PARAM]} />
          <EnvironmentPageFilter resetParamsOnChange={[SELECTED_ISSUE_QUERY_PARAM]} />
          <DatePageFilter resetParamsOnChange={[SELECTED_ISSUE_QUERY_PARAM]} />
        </PageFilterBar>
      </Container>
      <Grid
        flex={1}
        minHeight={0}
        columns={{
          'screen:xs': 'minmax(0, 1fr)',
          'screen:md': 'minmax(320px, 2fr) minmax(0, 3fr)',
        }}
      >
        <Stack
          as="section"
          aria-label={t('Issue inbox')}
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
            <SegmentedControl
              aria-label={t('Issue assignee')}
              size="xs"
              value={assignmentFilter}
              onChange={setAssignmentFilter}
            >
              <SegmentedControl.Item key="me">{t('Me')}</SegmentedControl.Item>
              <SegmentedControl.Item key="my_teams">
                {t('My Teams')}
              </SegmentedControl.Item>
            </SegmentedControl>
          </Flex>
          <Stack flex={1} minHeight={0} overflowY="auto">
            {SECTIONS.map(section => (
              <InboxSection
                key={section.key}
                section={section}
                assignmentFilter={assignmentFilter}
                selection={selection}
                isReady={isReady}
                selectedIssueId={selectedIssueId}
              />
            ))}
          </Stack>
        </Stack>
        <Stack
          as="aside"
          aria-label={t('Issue preview')}
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
        </Stack>
      </Grid>
    </Stack>
  );
}

interface InboxSectionProps {
  assignmentFilter: AssignmentFilter;
  isReady: boolean;
  section: InboxSectionConfig;
  selectedIssueId: string | null;
  selection: ReturnType<typeof usePageFilters>['selection'];
}

function InboxSection({
  assignmentFilter,
  isReady,
  section,
  selection,
  selectedIssueId,
}: InboxSectionProps) {
  const organization = useOrganization();
  const {start, end, period, utc} = selection.datetime;
  const queryResult = useInfiniteQuery({
    ...apiOptions.asInfinite<Group[]>()('/organizations/$organizationIdOrSlug/issues/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        project: selection.projects,
        environment: selection.environments,
        query: `${section.query} assigned:${assignmentFilter}`,
        sort: IssueSortOptions.PROGRESS,
        limit: ISSUE_LIMIT,
        expand: ['owners', 'derivedData'],
        ...(period ? {statsPeriod: period} : {}),
        ...(start ? {start: getUtcDateString(start)} : {}),
        ...(end ? {end: getUtcDateString(end)} : {}),
        ...(utc === null ? {} : {utc}),
      },
      staleTime: 0,
    }),
    enabled: isReady,
    refetchOnWindowFocus: true,
  });
  const groups = queryResult.data?.pages.flatMap(page => page.json) ?? [];
  const count = queryResult.data?.pages[0]?.headers['X-Hits'] ?? groups.length;
  const {data: members = []} = useMembers();
  const membersById = new Map(members.map(member => [member.id, member]));

  return (
    <Disclosure
      as="section"
      aria-label={section.label}
      defaultExpanded={section.defaultExpanded}
      size="sm"
    >
      <Container padding="xs" width="100%">
        <Container width="100%" padding="sm" background="secondary" radius="sm">
          <Disclosure.Title trailingItems={<Badge variant="muted">{count}</Badge>}>
            <Flex align="center" gap="sm">
              {getProgressIcon(section.progress)}
              <Heading as="h3" size="md">
                {section.label}
              </Heading>
            </Flex>
          </Disclosure.Title>
        </Container>
      </Container>
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
                  group={group}
                  selected={selectedIssueId === group.id}
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

function InboxIssueCard({
  assignedUser,
  group,
  selected,
}: {
  group: Group;
  selected: boolean;
  assignedUser?: User;
}) {
  const location = useLocation();
  const {title} = getTitle(group);
  const message = getMessage(group);

  return (
    <IssueCardLink
      aria-current={selected ? 'true' : undefined}
      data-selected={selected}
      to={{
        pathname: location.pathname,
        query: {...location.query, [SELECTED_ISSUE_QUERY_PARAM]: group.id},
      }}
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
          <Flex align="center" gap="xs">
            <ProjectAvatar project={group.project} size={18} hasTooltip={false} />
            <Text size="xs" variant="muted" ellipsis>
              {group.shortId}
            </Text>
          </Flex>
        </Stack>
        <Stack align="end" justify="between" gap="sm">
          <IssueSeenTimes group={group} />
          {group.assignedTo &&
            (group.assignedTo.type === 'user' ? (
              <UserAvatar
                user={assignedUser ?? group.assignedTo}
                size={18}
                hasTooltip={false}
                title={group.assignedTo.name}
              />
            ) : (
              <ActorAvatar
                actor={group.assignedTo}
                size={18}
                hasTooltip={false}
                title={group.assignedTo.name}
              />
            ))}
        </Stack>
      </Grid>
    </IssueCardLink>
  );
}

const InboxSectionContent = styled(Disclosure.Content)`
  padding: 0;
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
