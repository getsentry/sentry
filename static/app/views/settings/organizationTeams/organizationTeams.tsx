import {useState} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import partition from 'lodash/partition';

import {openCreateTeamModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {AccessRequest, Organization} from 'sentry/types';
import recreateRoute from 'sentry/utils/recreateRoute';
import useTeams from 'sentry/utils/useTeams';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import AllTeamsList from './allTeamsList';
import OrganizationAccessRequests from './organizationAccessRequests';

type Props = {
  access: Set<string>;
  features: Set<string>;
  onRemoveAccessRequest: (id: string, isApproved: boolean) => void;
  organization: Organization;
  requestList: AccessRequest[];
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

const LoadMoreWrapper = styled('div')`
  display: grid;
  gap: ${space(2)};
  align-items: center;
  justify-content: end;
  grid-auto-flow: column;
`;

export default OrganizationTeams;
