import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {useInfiniteQuery} from '@tanstack/react-query';
import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';
import uniqBy from 'lodash/uniqBy';

import {Alert} from '@sentry/scraps/alert';
import {TeamAvatar, UserAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';
import {Switch} from '@sentry/scraps/switch';
import {Heading, Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconSearch} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Team} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import type {
  DashboardDetails,
  DashboardListItem,
  DashboardPermissions,
} from 'sentry/views/dashboards/types';

const TEAMS_PER_PAGE = 100;
const MAX_TEAM_PAGES = 10;
const TEAM_ROW_HEIGHT = 32;
const TEAM_LABEL_PREFIX = 'dashboard-edit-access-team-';
const TEAM_LIST_VISIBLE_ROWS = 7;

type EditableDashboard = DashboardDetails | DashboardListItem;

interface PendingPermissions {
  isEditableByEveryone: boolean;
  teamIds: Set<string>;
}

function serializePermissions(
  pending: PendingPermissions
): Required<DashboardPermissions> {
  return {
    isEditableByEveryone: pending.isEditableByEveryone,
    teamsWithEditAccess: pending.isEditableByEveryone
      ? []
      : Array.from(pending.teamIds)
          .map(teamId => parseInt(teamId, 10))
          .sort((a, b) => a - b),
  };
}

function getSavedPermissions(
  permissions: DashboardPermissions | undefined
): PendingPermissions {
  return {
    isEditableByEveryone: !defined(permissions) || permissions.isEditableByEveryone,
    teamIds: new Set((permissions?.teamsWithEditAccess ?? []).map(String)),
  };
}

function useAllOrgTeams() {
  const organization = useOrganization();

  const result = useInfiniteQuery(
    apiOptions.asInfinite<Team[]>()('/organizations/$organizationIdOrSlug/teams/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {per_page: TEAMS_PER_PAGE},
      staleTime: 0,
    })
  );

  const pageCount = result.data?.pages.length ?? 0;
  const hasReachedPageCap = pageCount >= MAX_TEAM_PAGES;
  useFetchAllPages({result, enabled: !hasReachedPageCap});

  return {
    teams: uniqBy(result.data?.pages.flatMap(page => page.json) ?? [], team => team.id),
    isLoading: result.isPending || result.isFetchingNextPage,
    isEveryTeamLoaded: !result.isPending && !result.hasNextPage,
    isTeamListTruncated: hasReachedPageCap,
  };
}

export function useOpenEditAccessModal(
  dashboard: EditableDashboard,
  onChangeEditAccess?: (newDashboardPermissions: DashboardPermissions) => void
) {
  const {openModal} = useModal();
  const organization = useOrganization();

  return () => {
    trackAnalytics('dashboards2.edit_access.start', {organization});
    openModal(
      props => (
        <EditAccessModal
          {...props}
          dashboard={dashboard}
          onChangeEditAccess={onChangeEditAccess}
        />
      ),
      {closeEvents: 'escape-key'}
    );
  };
}

/**
 * Grants or revokes dashboard editing access, per team or to everyone. The
 * creator always keeps access and is shown as read-only.
 */
function EditAccessModal({
  Header,
  Body,
  Footer,
  closeModal,
  dashboard,
  onChangeEditAccess,
}: ModalRenderProps & {
  dashboard: EditableDashboard;
  onChangeEditAccess?: (newDashboardPermissions: DashboardPermissions) => void;
}) {
  const organization = useOrganization();
  const currentUser = useUser();
  const dashboardCreator = dashboard.createdBy;

  const userCanEditDashboardPermissions =
    dashboardCreator?.id === currentUser.id ||
    hasEveryAccess(['org:write'], {organization});

  const savedPermissions = useMemo(
    () => getSavedPermissions(dashboard.permissions),
    [dashboard.permissions]
  );
  const [pending, setPending] = useState<PendingPermissions>(savedPermissions);
  const [search, setSearch] = useState('');

  const {teams, isLoading, isEveryTeamLoaded, isTeamListTruncated} = useAllOrgTeams();
  const allTeamIds = useMemo(() => teams.map(team => team.id), [teams]);

  const sortedTeams = useMemo(() => {
    const hadAccess = (teamId: string) =>
      savedPermissions.isEditableByEveryone || savedPermissions.teamIds.has(teamId);
    return sortBy(teams, team => [!hadAccess(team.id), team.slug]);
  }, [teams, savedPermissions]);

  const visibleTeams = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? sortedTeams.filter(team => team.slug.toLowerCase().includes(query))
      : sortedTeams;
  }, [sortedTeams, search]);

  const isTeamChecked = (teamId: string) =>
    pending.isEditableByEveryone || pending.teamIds.has(teamId);

  const selectAllState = pending.isEditableByEveryone
    ? true
    : pending.teamIds.size > 0
      ? ('indeterminate' as const)
      : false;

  const isDirty = !isEqual(
    serializePermissions(pending),
    serializePermissions(savedPermissions)
  );

  const handleToggleSelectAll = () => {
    setPending(prev => ({
      isEditableByEveryone: !prev.isEditableByEveryone,
      teamIds: new Set(),
    }));
  };

  const handleToggleTeam = (teamId: string) => {
    setPending(prev => {
      if (prev.isEditableByEveryone || prev.teamIds.has(teamId)) {
        const remaining = new Set(prev.isEditableByEveryone ? allTeamIds : prev.teamIds);
        remaining.delete(teamId);
        return {isEditableByEveryone: false, teamIds: remaining};
      }

      const selected = new Set(prev.teamIds);
      selected.add(teamId);

      if (isEveryTeamLoaded && allTeamIds.every(id => selected.has(id))) {
        return {isEditableByEveryone: true, teamIds: new Set()};
      }
      return {isEditableByEveryone: false, teamIds: selected};
    });
  };

  const handleApply = () => {
    const newDashboardPermissions = serializePermissions(pending);

    trackAnalytics('dashboards2.edit_access.save', {
      organization,
      editable_by: newDashboardPermissions.isEditableByEveryone
        ? 'all'
        : newDashboardPermissions.teamsWithEditAccess.length > 0
          ? 'team_selection'
          : 'owner_only',
      team_count: newDashboardPermissions.teamsWithEditAccess.length || undefined,
    });

    onChangeEditAccess?.(newDashboardPermissions);
    closeModal();
  };

  const creatorLabel =
    dashboardCreator?.id === currentUser.id || !dashboardCreator?.email
      ? tct('You ([email])', {email: currentUser.email})
      : dashboardCreator.email;

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h3" size="xl">
          {t('View Permissions')}
        </Heading>
      </Header>
      <Body>
        <Stack gap="md">
          {!userCanEditDashboardPermissions && (
            <Alert variant="info">
              {t('These settings can only be edited by the owner of this dashboard')}
            </Alert>
          )}

          {userCanEditDashboardPermissions && isTeamListTruncated && (
            <Alert variant="warning">
              {t(
                'This organization has too many teams to list here. You can still grant or revoke access for everyone.'
              )}
            </Alert>
          )}

          <InputGroup>
            <InputGroup.LeadingItems disablePointerEvents>
              <IconSearch variant="muted" size="xs" />
            </InputGroup.LeadingItems>
            <InputGroup.Input
              size="sm"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={t('Search Team')}
              aria-label={t('Search Team')}
              autoComplete="off"
            />
          </InputGroup>

          {dashboardCreator && (
            <Flex
              align="center"
              justify="between"
              gap="md"
              padding="md lg"
              border="primary"
              radius="md"
            >
              <Flex align="center" gap="md">
                <UserAvatar user={dashboardCreator} size={16} />
                <Text size="md" ellipsis>
                  {creatorLabel}
                </Text>
              </Flex>
              <Text size="md" variant="muted">
                {t('Owner')}
              </Text>
            </Flex>
          )}

          <Stack role="group" aria-label={t('Teams within your Organization')}>
            <Flex align="center" justify="between" gap="md" padding="md lg">
              <Text size="md" bold variant="muted">
                {t('Teams')}
              </Text>
              <Flex align="center" gap="md">
                <Text size="md" variant="muted" aria-hidden>
                  {t('Select All')}
                </Text>
                <Checkbox
                  checked={selectAllState}
                  onChange={handleToggleSelectAll}
                  disabled={!userCanEditDashboardPermissions}
                  aria-label={t('Select All')}
                />
              </Flex>
            </Flex>

            <Container
              border="primary"
              radius="md"
              overflowY="auto"
              maxHeight={`${TEAM_LIST_VISIBLE_ROWS * TEAM_ROW_HEIGHT}px`}
            >
              {isLoading ? (
                <LoadingIndicator />
              ) : visibleTeams.length === 0 ? (
                <Flex justify="center" padding="xl">
                  <Text size="md" variant="muted">
                    {search ? t('No teams match your search') : t('No teams found')}
                  </Text>
                </Flex>
              ) : (
                <TeamList as="ul">
                  {visibleTeams.map((team, index) => (
                    <Flex
                      as="li"
                      key={team.id}
                      align="center"
                      justify="between"
                      gap="md"
                      padding="md lg"
                      borderBottom={
                        index === visibleTeams.length - 1 ? undefined : 'secondary'
                      }
                    >
                      <Flex align="center" gap="md" minWidth={0}>
                        <Flex as="span" aria-hidden>
                          <TeamAvatar team={team} size={16} />
                        </Flex>
                        <Text id={`${TEAM_LABEL_PREFIX}${team.id}`} size="md" ellipsis>
                          <span aria-hidden="true">#</span>
                          {team.slug}
                        </Text>
                      </Flex>
                      <Flex align="center" gap="md">
                        <Text size="md" variant="muted" aria-hidden>
                          {t('Editor')}
                        </Text>
                        <Switch
                          checked={isTeamChecked(team.id)}
                          onChange={() => handleToggleTeam(team.id)}
                          disabled={
                            !userCanEditDashboardPermissions || !isEveryTeamLoaded
                          }
                          aria-labelledby={`${TEAM_LABEL_PREFIX}${team.id}`}
                        />
                      </Flex>
                    </Flex>
                  ))}
                </TeamList>
              )}
            </Container>
          </Stack>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md" justify="end">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            variant="primary"
            onClick={handleApply}
            disabled={!userCanEditDashboardPermissions || !isDirty}
            tooltipProps={
              userCanEditDashboardPermissions
                ? undefined
                : {
                    title: t(
                      'Only the creator of this dashboard can manage editor access'
                    ),
                  }
            }
          >
            {t('Apply')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  );
}

const TeamList = styled(Container)`
  list-style: none;
  margin: 0;
  padding: 0;
`;
