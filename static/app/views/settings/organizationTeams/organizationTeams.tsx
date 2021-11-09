import {useState} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import partition from 'lodash/partition';

import {openCreateTeamModal} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import SearchBar from 'app/components/searchBar';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {DEFAULT_DEBOUNCE_DURATION} from 'app/constants';
import {IconAdd} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {AccessRequest, Organization} from 'app/types';
import recreateRoute from 'app/utils/recreateRoute';
import useTeams from 'app/utils/useTeams';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

import AllTeamsList from './allTeamsList';
import OrganizationAccessRequests from './organizationAccessRequests';

type Props = {
  access: Set<string>;
  features: Set<string>;
  organization: Organization;
  requestList: AccessRequest[];
  onRemoveAccessRequest: (id: string, isApproved: boolean) => void;
} & RouteComponentProps<{orgId: string}, {}>;

function OrganizationTeams({
  organization,
  access,
  features,
  routes,
  params,
  requestList,
  onRemoveAccessRequest,
}: Props) {
  if (!organization) {
    return null;
  }
  const canCreateTeams = access.has('project:admin');

  const action = (
    <Button
      priority="primary"
      size="small"
      disabled={!canCreateTeams}
      title={
        !canCreateTeams ? t('You do not have permission to create teams') : undefined
      }
      onClick={() =>
        openCreateTeamModal({
          organization,
        })
      }
      icon={<IconAdd size="xs" isCircled />}
    >
      {t('Create Team')}
    </Button>
  );

  const teamRoute = routes.find(({path}) => path === 'teams/');
  const urlPrefix = teamRoute
    ? recreateRoute(teamRoute, {routes, params, stepBack: -2})
    : '';

  const title = t('Teams');

  const [teamQuery, setTeamQuery] = useState('');
  const {initiallyLoaded} = useTeams({provideUserTeams: true});
  const {teams, onSearch} = useTeams();

  const debouncedSearch = debounce(onSearch, DEFAULT_DEBOUNCE_DURATION);
  function handleSearch(query: string) {
    setTeamQuery(query);
    debouncedSearch(query);
  }

  const filteredTeams = teams.filter(team =>
    `#${team.slug}`.toLowerCase().includes(teamQuery.toLowerCase())
  );
  const [userTeams, otherTeams] = partition(filteredTeams, team => team.isMember);

  return (
    <div data-test-id="team-list">
      <SentryDocumentTitle title={title} orgSlug={organization.slug} />
      <SettingsPageHeader title={title} action={action} />

      <OrganizationAccessRequests
        orgId={params.orgId}
        requestList={requestList}
        onRemoveAccessRequest={onRemoveAccessRequest}
      />
      <StyledSearchBar
        placeholder={t('Search teams')}
        onChange={handleSearch}
        query={teamQuery}
      />
      <Panel>
        <PanelHeader>{t('Your Teams')}</PanelHeader>
        <PanelBody>
          {initiallyLoaded ? (
            <AllTeamsList
              urlPrefix={urlPrefix}
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
            urlPrefix={urlPrefix}
            organization={organization}
            teamList={otherTeams}
            access={access}
            openMembership={
              !!(features.has('open-membership') || access.has('org:write'))
            }
          />
        </PanelBody>
      </Panel>
    </div>
  );
}

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(2)};
`;

export default OrganizationTeams;
