import {useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import partition from 'lodash/partition';

import {openCreateTeamModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {TeamRoleColumnLabel} from 'sentry/components/teamRoleUtils';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {AccessRequest, Organization} from 'sentry/types/organization';
import {useTeams} from 'sentry/utils/useTeams';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {RoleOverwritePanelAlert} from 'sentry/views/settings/organizationTeams/roleOverwriteWarning';

import AllTeamsList from './allTeamsList';
import {GRID_TEMPLATE} from './allTeamsRow';
import OrganizationAccessRequests from './organizationAccessRequests';

type Props = {
  access: Set<string>;
  features: Set<string>;
  onRemoveAccessRequest: (id: string, isApproved: boolean) => void;
  organization: Organization;
  requestList: AccessRequest[];
} & RouteComponentProps;

function OrganizationTeams({
  organization,
  access,
  features,
  requestList,
  onRemoveAccessRequest,
}: Props) {
  const [teamQuery, setTeamQuery] = useState('');
  const {initiallyLoaded} = useTeams({provideUserTeams: true});
  const {teams, onSearch, loadMore, hasMore, fetching} = useTeams();

  if (!organization) {
    return null;
  }
  const canCreateTeams = access.has('project:admin');

  const action = (
    <Button
      priority="primary"
      size="sm"
      disabled={!canCreateTeams}
      title={
        !canCreateTeams ? t('You do not have permission to create teams') : undefined
      }
      onClick={() =>
        openCreateTeamModal({
          organization,
        })
      }
      icon={<IconAdd isCircled />}
    >
      {t('Create Team')}
    </Button>
  );

  const title = t('Teams');

  const debouncedSearch = debounce(onSearch, DEFAULT_DEBOUNCE_DURATION);
  function handleSearch(query: string) {
    setTeamQuery(query);
    debouncedSearch(query);
  }

  const {slug: orgSlug, orgRole, orgRoleList, teamRoleList} = organization;
  const filteredTeams = teams.filter(team =>
    `#${team.slug}`.toLowerCase().includes(teamQuery.toLowerCase())
  );
  const [userTeams, otherTeams] = partition(filteredTeams, team => team.isMember);

  return (
    <div data-test-id="team-list">
      <SentryDocumentTitle title={title} orgSlug={orgSlug} />
      <SettingsPageHeader title={title} action={action} />

      <OrganizationAccessRequests
        orgSlug={organization.slug}
        requestList={requestList}
        onRemoveAccessRequest={onRemoveAccessRequest}
      />
      <StyledSearchBar
        placeholder={t('Search teams')}
        onChange={handleSearch}
        query={teamQuery}
      />
      <Panel>
        <StyledPanelHeader>
          <div>{t('Your Teams')}</div>
          <div />
          <div>
            <TeamRoleColumnLabel />
          </div>
          <div />
        </StyledPanelHeader>
        <PanelBody>
          <RoleOverwritePanelAlert
            orgRole={orgRole}
            orgRoleList={orgRoleList}
            teamRoleList={teamRoleList}
            isSelf
          />
          {initiallyLoaded ? (
            <AllTeamsList
              organization={organization}
              teamList={userTeams.filter(team => team.slug.includes(teamQuery))}
              access={access}
              openMembership={false}
            />
          ) : (
            <LoadingIndicator />
          )}
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHeader>{t('Other Teams')}</PanelHeader>
        <PanelBody>
          <AllTeamsList
            organization={organization}
            teamList={otherTeams}
            access={access}
            openMembership={
              !!(features.has('open-membership') || access.has('org:write'))
            }
          />
        </PanelBody>
      </Panel>
      {hasMore && (
        <LoadMoreWrapper>
          {fetching && <LoadingIndicator mini />}
          <Button onClick={() => loadMore(teamQuery)}>{t('Show more')}</Button>
        </LoadMoreWrapper>
      )}
    </div>
  );
}

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(2)};
`;

const StyledPanelHeader = styled(PanelHeader)`
  ${GRID_TEMPLATE}
`;

const LoadMoreWrapper = styled('div')`
  display: grid;
  gap: ${space(2)};
  align-items: center;
  justify-content: end;
  grid-auto-flow: column;
`;

export default OrganizationTeams;
