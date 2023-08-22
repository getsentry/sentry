import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import UserBadge from 'sentry/components/idBadge/userBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
// import Placeholder from 'sentry/components/placeholder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
// import ConfigStore from 'sentry/stores/configStore';
// import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
// import {useApiQuery} from 'sentry/utils/queryClient';
// import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {ErrorWidget} from 'sentry/views/user/widgets/errors';

import {ReplayWidget} from './widgets/replays';
import {TransactionWidget} from './widgets/transactions';
import {UserTimeline} from './timeline';
// import useOrganization from 'sentry/utils/useOrganization';

type Props = RouteComponentProps<{userId: string}, {}, any, {name: string}>;

// type FetchReplaysResponse = {};

function UserDetails({params: {userId}}: Props) {
  // const config = useLegacyStore(ConfigStore);
  const location = useLocation();
  const name = location.query.name;
  // const organization = useOrganization();
  // const {slug: orgSlug} = organization;
  const title = 'User Profile';

  // const {
  //   isLoading,
  //   isError,
  //   data: projects,
  //   refetch,
  // } = useApiQuery<FetchReplaysResponse>(['/replays/', {query: {orgSlug}}], {
  //   retry: false,
  //   staleTime: 0,
  // });

  const header = (
    <Header>
      <Layout.HeaderContent>
        <UserBadge
          avatarSize={32}
          displayName={<Layout.Title>{name || t('Unknown User')}</Layout.Title>}
          user={{
            // @ts-expect-error
            name: name || '',
            // email: user.email || '',
            // username: user.username || '',
            // ip_address: user.ip || '',
            id: userId || '',
          }}
          displayEmail=""
        />
      </Layout.HeaderContent>

      <ButtonActionsWrapper>
        <div>:fire: 1</div>
        <div>:fire: 1</div>
        <div>:fire: 1</div>
      </ButtonActionsWrapper>
    </Header>
  );

  return (
    <SentryDocumentTitle title={title}>
      <FullViewport>
        {header}
        <PageFiltersContainer>
          <Body>
            <Main fullWidth>
              <FilterBar>
                <PageFilterBar condensed>
                  <ProjectPageFilter resetParamsOnChange={['cursor']} />
                  <EnvironmentPageFilter resetParamsOnChange={['cursor']} />
                  <DatePageFilter
                    defaultPeriod="7d"
                    alignDropdown="left"
                    resetParamsOnChange={['cursor']}
                  />
                </PageFilterBar>
              </FilterBar>
              <Widgets>
                {/* Add widgets here */}
                <ReplayWidget userId={userId} />
                <TransactionWidget userId={userId} />
                <ErrorWidget userId={userId} />
                <div>placeholder</div>
              </Widgets>

              <UserTimeline userId={userId} />
            </Main>
          </Body>
        </PageFiltersContainer>
      </FullViewport>
    </SentryDocumentTitle>
  );
}

const Main = styled(Layout.Main)`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  width: 100%;
`;

const Body = styled(Layout.Body)`
  display: flex !important;
  overflow: hidden;
`;

const Header = styled(Layout.Header)`
  gap: ${space(1)};
  padding-bottom: ${space(1.5)};
`;

const ButtonActionsWrapper = styled(Layout.HeaderActions)`
  flex-direction: row;
  justify-content: flex-end;
  gap: ${space(1)};
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    margin-bottom: 0;
  }
`;

const FilterBar = styled('div')`
  margin-bottom: ${space(2)};
`;

const Widgets = styled('section')`
  display: grid;
  gap: ${space(2)};
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  width: 100%;
`;

const FullViewport = styled('div')`
  height: 100vh;
  width: 100%;

  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;

  /*
   * The footer component is a sibling of this div.
   * Remove it so the replay can take up the
   * entire screen.
   */
  ~ footer {
    display: none;
  }

  /*
  TODO: Set \`body { overflow: hidden; }\` so that the body doesn't wiggle
  when you try to scroll something that is non-scrollable.
  */
`;

export default UserDetails;
