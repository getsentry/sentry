import {useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import partition from 'lodash/partition';

import {Button} from '@sentry/scraps/button';

import {openCreateTeamModal} from 'sentry/actionCreators/modal';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SearchBar from 'sentry/components/searchBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {AccessRequest, Organization} from 'sentry/types/organization';
import {useTeams} from 'sentry/utils/useTeams';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import OrganizationAccessRequests from './organizationAccessRequests';
import {OtherTeamsTable} from './otherTeamsTable';
import {YourTeamsTable} from './yourTeamsTable';

type Props = {
  access: Set<string>;
  features: Set<string>;
  onRemoveAccessRequest: (id: string, isApproved: boolean) => void;
  organization: Organization;
  requestList: AccessRequest[];
};

export default function OrganizationTeams({
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
  const openMembership = !!(features.has('open-membership') || access.has('org:write'));

  const action = (
    <Button
      priority="primary"
      size="sm"
      disabled={!canCreateTeams}
      title={canCreateTeams ? undefined : t('You do not have permission to create teams')}
      onClick={() => openCreateTeamModal({organization})}
      icon={<IconAdd />}
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

  const filteredTeams = teams.filter(team =>
    `#${team.slug}`.toLowerCase().includes(teamQuery.toLowerCase())
  );
  const [userTeams, otherTeams] = partition(filteredTeams, team => team.isMember);
  const filteredUserTeams = userTeams.filter(team => team.slug.includes(teamQuery));

  return (
    <div data-test-id="team-list">
      <SentryDocumentTitle title={title} orgSlug={organization.slug} />
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
      <YourTeamsTable
        teams={filteredUserTeams}
        isLoading={!initiallyLoaded}
        canCreateTeams={canCreateTeams}
        hasSearch={teamQuery.length > 0}
        allTeamsCount={teams.length}
      />
      <OtherTeamsTable
        teams={otherTeams}
        openMembership={openMembership}
        hasSearch={teamQuery.length > 0}
        allTeamsCount={teams.length}
      />
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
