import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Badge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {inlineCodeStyles} from '@sentry/scraps/code';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import type {IndexedMembersByProject} from 'sentry/actionCreators/members';
import {
  CrumbContainer,
  NavigationCrumbs,
  ShortId,
} from 'sentry/components/events/eventDrawer';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {GroupListHeader} from 'sentry/components/issues/groupListHeader';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {Placeholder} from 'sentry/components/placeholder';
import {
  DEFAULT_STREAM_GROUP_STATS_PERIOD,
  StreamGroup,
} from 'sentry/components/stream/group';
import {IconChevron, IconFocus} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {useQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SupergroupFeedback} from 'sentry/views/issueList/supergroups/supergroupFeedback';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';

const DRAWER_COLUMNS: GroupListColumn[] = [
  'event',
  'users',
  'assignee',
  'firstSeen',
  'lastSeen',
];

interface SupergroupDetailDrawerProps {
  supergroup: SupergroupDetail;
  filterWithCurrentSearch?: boolean;
  memberList?: IndexedMembersByProject;
}

export function SupergroupDetailDrawer({
  supergroup,
  memberList,
  filterWithCurrentSearch,
}: SupergroupDetailDrawerProps) {
  return (
    <Fragment>
      <DrawerHeader hideBar>
        <Flex justify="between" align="center" gap="md" flexGrow={1}>
          <Flex align="center" gap="sm">
            <NavigationCrumbs
              crumbs={[
                {label: t('Supergroups')},
                {
                  label: (
                    <CrumbContainer>
                      <ShortId>{`SG-${supergroup.id}`}</ShortId>
                    </CrumbContainer>
                  ),
                },
              ]}
            />
            <Badge variant="experimental">{t('Experimental')}</Badge>
          </Flex>
        </Flex>
      </DrawerHeader>
      <DrawerContentBody>
        <SupergroupFeedback supergroupId={supergroup.id} />
        <Container padding="2xl" borderBottom="muted">
          <Stack gap="lg">
            <Heading as="h2" size="lg">
              <StyledMarkedText text={supergroup.title} inline as="span" />
            </Heading>

            <Flex wrap="wrap" gap="lg">
              {supergroup.error_type && (
                <Flex gap="xs">
                  <Text size="sm" variant="muted">
                    {t('Error')}
                  </Text>
                  <Text size="sm">{supergroup.error_type}</Text>
                </Flex>
              )}
              {supergroup.code_area && (
                <Flex gap="xs">
                  <Text size="sm" variant="muted">
                    {t('Location')}
                  </Text>
                  <Text size="sm">{supergroup.code_area}</Text>
                </Flex>
              )}
            </Flex>

            {supergroup.summary && (
              <Container background="secondary" border="primary" radius="md">
                <Flex direction="column" padding="md lg" gap="sm">
                  <Flex align="center" gap="xs">
                    <IconFocus size="xs" variant="promotion" />
                    <Text size="sm" bold>
                      {t('Root Cause')}
                    </Text>
                  </Flex>
                  <Text size="sm">
                    <StyledMarkedText text={supergroup.summary} inline as="span" />
                  </Text>
                </Flex>
              </Container>
            )}
          </Stack>
        </Container>

        {supergroup.group_ids.length > 0 && (
          <Container padding="xl 2xl">
            <SupergroupIssueList
              groupIds={supergroup.group_ids}
              memberList={memberList}
              filterWithCurrentSearch={filterWithCurrentSearch}
            />
          </Container>
        )}
      </DrawerContentBody>
    </Fragment>
  );
}

const PAGE_SIZE = 25;

function SupergroupIssueList({
  groupIds,
  memberList,
  filterWithCurrentSearch,
}: {
  groupIds: number[];
  filterWithCurrentSearch?: boolean;
  memberList?: IndexedMembersByProject;
}) {
  const organization = useOrganization();
  const location = useLocation();
  const [page, setPage] = useState(0);

  const {
    query: searchQuery,
    project,
    environment,
    statsPeriod,
    start,
    end,
  } = location.query;
  const query = typeof searchQuery === 'string' ? searchQuery : '';
  const issueIdFilter = `issue.id:[${groupIds.join(',')}]`;
  const totalPages = Math.ceil(groupIds.length / PAGE_SIZE);
  const pageGroupIds = groupIds.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
  const {data: matchedGroups, isPending: matchPending} = useQuery({
    ...apiOptions.as<Group[]>()('/organizations/$organizationIdOrSlug/issues/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        project,
        environment,
        statsPeriod,
        start,
        end,
        query: `${query} ${issueIdFilter}`,
        limit: groupIds.length,
      },
      staleTime: 30_000,
    }),
    enabled: !!filterWithCurrentSearch,
  });

  const isPending = allPending || (!!filterWithCurrentSearch && matchPending);

  if (isPending) {
    return (
      <PanelContainer>
        <GroupListHeader withChart={false} withColumns={DRAWER_COLUMNS} />
        <PanelBody>
          {pageGroupIds.map(id => (
            <PlaceholderRow key={id}>
              <Placeholder height="82px" />
            </PlaceholderRow>
          ))}
        </PanelBody>
      </PanelContainer>
    );
  }

  const matchedIds = new Set(matchedGroups?.map(g => g.id));
  const groupMap = new Map(allGroups?.map(g => [g.id, g]));

  // Sort: matched first, then the rest
  const sortedGroups = [...pageGroupIds]
    .map(id => groupMap.get(String(id)))
    .filter((g): g is Group => g !== undefined)
    .sort((a, b) => {
      const aMatched = matchedIds.has(a.id);
      const bMatched = matchedIds.has(b.id);
      if (aMatched !== bMatched) {
        return aMatched ? -1 : 1;
      }
      return 0;
    });

  return (
    <Fragment>
      <PanelContainer>
        <GroupListHeader withChart={false} withColumns={DRAWER_COLUMNS} />
        <PanelBody>
          {sortedGroups.map(group => {
            const members = memberList?.[group.project?.slug]
              ? memberList[group.project.slug]
              : undefined;
            return (
              <HighlightableRow key={group.id} highlighted={matchedIds.has(group.id)}>
                <StreamGroup
                  group={group}
                  canSelect={false}
                  withChart={false}
                  withColumns={DRAWER_COLUMNS}
                  memberList={members}
                  statsPeriod={DEFAULT_STREAM_GROUP_STATS_PERIOD}
                  source="supergroup-drawer"
                />
              </HighlightableRow>
            );
          })}
        </PanelBody>
      </PanelContainer>
      {totalPages > 1 && (
        <Flex justify="end" align="center" gap="sm" padding="md 0">
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
    </Fragment>
  );
}

const DrawerContentBody = styled(DrawerBody)`
  padding: 0;
`;

const PanelContainer = styled(Panel)`
  container-type: inline-size;
`;

const PlaceholderRow = styled('div')`
  padding: ${p => p.theme.space.md};

  &:not(:last-child) {
    border-bottom: solid 1px ${p => p.theme.tokens.border.secondary};
  }
`;

const HighlightableRow = styled('div')<{highlighted: boolean}>`
  ${p =>
    !p.highlighted &&
    css`
      opacity: 0.6;
    `}
`;

const StyledMarkedText = styled(MarkedText)`
  code:not(pre code) {
    ${p => inlineCodeStyles(p.theme)};
  }
`;
