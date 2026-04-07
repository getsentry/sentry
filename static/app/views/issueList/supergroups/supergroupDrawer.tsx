import {Fragment, useMemo, useState} from 'react';
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
import {GroupStore} from 'sentry/stores/groupStore';
import type {Group} from 'sentry/types/group';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SupergroupFeedback} from 'sentry/views/issueList/supergroups/supergroupFeedback';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';

const PAGE_SIZE = 20;

const DRAWER_COLUMNS: GroupListColumn[] = [
  'event',
  'users',
  'assignee',
  'firstSeen',
  'lastSeen',
];

interface SupergroupDetailDrawerProps {
  matchedGroupIds: string[];
  supergroup: SupergroupDetail;
  memberList?: IndexedMembersByProject;
}

export function SupergroupDetailDrawer({
  supergroup,
  matchedGroupIds,
  memberList,
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
              matchedGroupIds={matchedGroupIds}
              memberList={memberList}
            />
          </Container>
        )}
      </DrawerContentBody>
    </Fragment>
  );
}

function SupergroupIssueList({
  groupIds,
  matchedGroupIds,
  memberList,
}: {
  groupIds: number[];
  matchedGroupIds: string[];
  memberList?: IndexedMembersByProject;
}) {
  const organization = useOrganization();
  const [page, setPage] = useState(0);

  // Sort: matched first, then other loaded groups, then unloaded
  const {sortedGroupIds, loadedIds} = useMemo(() => {
    const matched: number[] = [];
    const loaded: number[] = [];
    const cachedIds = new Set<string>();
    const unloaded: number[] = [];

    for (const id of groupIds) {
      const strId = String(id);
      if (GroupStore.get(strId)) {
        cachedIds.add(strId);
        if (matchedGroupIds.includes(strId)) {
          matched.push(id);
        } else {
          loaded.push(id);
        }
      } else {
        unloaded.push(id);
      }
    }

    return {sortedGroupIds: [...matched, ...loaded, ...unloaded], loadedIds: cachedIds};
  }, [groupIds, matchedGroupIds]);

  const totalPages = Math.ceil(sortedGroupIds.length / PAGE_SIZE);
  const pageGroupIds = sortedGroupIds.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageUnloadedIds = pageGroupIds.filter(id => !loadedIds.has(String(id)));

  const {data: fetchedGroups, isPending} = useApiQuery<Group[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/issues/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          group: pageUnloadedIds.map(String),
          project: ALL_ACCESS_PROJECTS,
        },
      },
    ],
    {
      staleTime: 30_000,
      enabled: pageUnloadedIds.length > 0,
    }
  );

  return (
    <Fragment>
      {matchedGroupIds.length > 0 && (
        <Flex align="center" gap="xs" padding="0 0 md 0">
          <MatchedIndicator />
          <Text size="sm" variant="muted">
            {t('Visible in current results')}
          </Text>
        </Flex>
      )}
      <PanelContainer>
        <GroupListHeader withChart={false} withColumns={DRAWER_COLUMNS} />
        <PanelBody>
          {pageGroupIds.map(id => {
            const strId = String(id);
            const group =
              (GroupStore.get(strId) as Group | undefined) ??
              fetchedGroups?.find(g => g.id === strId);

            if (group) {
              const members = memberList?.[group.project?.slug]
                ? memberList[group.project.slug]
                : undefined;
              return (
                <HighlightableRow
                  key={group.id}
                  highlighted={matchedGroupIds.includes(group.id)}
                >
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
            }

            if (isPending) {
              return (
                <PlaceholderRow key={strId}>
                  <Placeholder height="82px" />
                </PlaceholderRow>
              );
            }

            return null;
          })}
        </PanelBody>
      </PanelContainer>
      {totalPages > 1 && (
        <Flex justify="end" align="center" gap="sm" padding="md 0">
          <Text size="sm" variant="muted">
            {`${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, sortedGroupIds.length)} of ${sortedGroupIds.length}`}
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

const MatchedIndicator = styled('div')`
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: ${p => p.theme.tokens.graphics.accent.vibrant};
  flex-shrink: 0;
`;

const HighlightableRow = styled('div')<{highlighted: boolean}>`
  ${p =>
    p.highlighted &&
    css`
      background: ${p.theme.tokens.background.secondary};
      border-left: 3px solid ${p.theme.tokens.border.accent.vibrant};
    `}
`;

const StyledMarkedText = styled(MarkedText)`
  code:not(pre code) {
    ${p => inlineCodeStyles(p.theme)};
  }
`;
