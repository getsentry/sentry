import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import UserBadge from 'sentry/components/idBadge/userBadge';
import Truncate from 'sentry/components/truncate';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {useNavigate} from 'sentry/utils/useNavigate';

import DebounceSearch from 'admin/components/debounceSearch';
import Overview from 'admin/views/overview';

function HomePage() {
  const navigate = useNavigate();
  const regions = ConfigStore.get('regions');
  const [oldSplash, setOldSplash] = useState(false);
  const [regionUrl, setRegionUrl] = useState(regions[0]!.url);

  const buildOrgPath = (org: any) => `/_admin/customers/${org.slug}/`;
  const orgSelect = (org: any) => {
    navigate(buildOrgPath(org));
  };
  const orgSubmit = (query: string) => {
    navigate({
      pathname: '/_admin/customers/',
      query: {
        query,
        regionUrl,
      },
    });
  };
  const buildUserPath = (user: any) => `/_admin/users/${user.id}/`;
  const userSelect = (user: any) => {
    navigate(buildUserPath(user));
  };
  const userSubmit = (query: string) => {
    navigate({
      pathname: '/_admin/users/',
      query: {
        query,
      },
    });
  };
  const buildProjPath = (proj: any) =>
    `/_admin/customers/${proj.organization.slug}/projects/${proj.slug}/`;
  const projSelect = (proj: any) => {
    navigate(buildProjPath(proj));
  };

  const renderOrgSuggestion = (org: any) => {
    return (
      <div>
        <strong>{org.slug}</strong> (<SecondaryText>{org.name}</SecondaryText>)
      </div>
    );
  };
  const renderUserSuggestion = (user: any) => {
    return (
      <UserBadge
        hideEmail
        user={user}
        displayName={<Truncate maxLength={40} value={user.name} />}
      />
    );
  };
  const renderProjSuggestion = (proj: any) => {
    return (
      <div>
        <strong>{proj.organization.slug}</strong>: {proj.slug} (id:{' '}
        <SecondaryText>{proj.id}</SecondaryText>)
      </div>
    );
  };

  if (oldSplash) {
    return <Overview />;
  }
  return (
    <SplashWrapper>
      <Header>
        <HeaderTitle>Welcome to the Admin Portal!</HeaderTitle>
      </Header>
      <div>
        <strong>
          This is an internal tool meant to enable Sentry Employees (you!) to better
          assist and resolve issues that may arise for our customers.
        </strong>
        <div>If you have any questions, ask us in #discuss-admin</div>
      </div>
      <Centered>
        <Warning>
          <strong>NOTE:</strong>&nbsp;
          <span>All actions are logged and audited</span>
        </Warning>
      </Centered>
      <div>
        <SearchLabel>Users</SearchLabel>
        <DebounceSearch
          path="/users/"
          onSelectResult={userSelect}
          onSearch={userSubmit}
          suggestionContent={renderUserSuggestion}
          placeholder="Query users"
          createSuggestionPath={buildUserPath}
        />
      </div>
      <RegionPanel>
        <CompactSelect
          triggerProps={{prefix: 'Region'}}
          value={regionUrl}
          options={regions.map((r: any) => ({
            label: r.name,
            value: r.url,
          }))}
          onChange={opt => {
            setRegionUrl(opt.value);
          }}
        />

        <SearchLabel>Organizations</SearchLabel>
        <DebounceSearch
          host={regionUrl}
          path="/customers/"
          onSelectResult={orgSelect}
          onSearch={orgSubmit}
          suggestionContent={renderOrgSuggestion}
          placeholder="Query organizations"
          createSuggestionPath={buildOrgPath}
        />

        <SearchLabel>Projects (by ID)</SearchLabel>
        <DebounceSearch
          createSuggestionPath={buildProjPath}
          onSelectResult={projSelect}
          placeholder="Project ID"
          queryParam="id"
          host={regionUrl}
          path="/projects/?show=all"
          suggestionContent={renderProjSuggestion}
        />
      </RegionPanel>

      <OverviewWrap>
        <div>Looking for the old overview page?</div>
        <Button size="xs" onClick={() => setOldSplash(true)}>
          click here
        </Button>
      </OverviewWrap>
    </SplashWrapper>
  );
}

const RegionPanel = styled('div')`
  padding: ${space(4)} 0;
`;

const SearchLabel = styled('label')`
  display: block;
  margin-top: ${space(2)};
`;

const SplashWrapper = styled('div')`
  padding: ${space(3)};
`;

const Header = styled('div')`
  display: flex;
  align-items: center;
  margin: ${space(4)} 0;
`;
const HeaderTitle = styled('h3')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: normal;
  color: ${p => p.theme.tokens.content.primary};
`;

const OverviewWrap = styled('div')`
  margin: ${space(2)} 0;
`;
const SecondaryText = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
`;

const Centered = styled('div')`
  display: flex;
  justify-content: center;
  margin: ${space(2)} 0;
`;

const Warning = styled('div')`
  color: red;
  font-size: large;
`;

export default HomePage;
