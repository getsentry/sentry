import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import UserBadge from 'sentry/components/idBadge/userBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ErrorWidget} from 'sentry/views/user/widgets/errors';

import {ReplayWidget} from './widgets/replays';
import {TransactionWidget} from './widgets/transactions';
import {VitalsWidget} from './widgets/vitals';
import {Metrics} from './metrics';
import {UserTimeline} from './timeline';
import {useUserParams} from './useUserParams';

function UserDetails() {
  const {name, userKey, userValue} = useUserParams();

  const title = 'User Profile';

  if (!userKey || !userValue) {
    return (
      <SentryDocumentTitle title={title}>
        <FullViewport>
          <Header>
            <HeaderContent>Invalid User</HeaderContent>
          </Header>
        </FullViewport>
      </SentryDocumentTitle>
    );
  }

  const header = (
    <Header>
      <HeaderContent>
        <UserBadge
          avatarSize={32}
          displayName={<Layout.Title>{name || t('Unknown User')}</Layout.Title>}
          user={{
            // @ts-expect-error
            name: name || '',
            [userKey as string]: userValue,
          }}
          displayEmail=""
        />
      </HeaderContent>

      <ButtonActionsWrapper>
        <Metrics userKey={userKey} userValue={userValue} />
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
                <ErrorWidget userKey={userKey} userValue={userValue} />
                <TransactionWidget userKey={userKey} userValue={userValue} />
                <VitalsWidget userKey={userKey} userValue={userValue} />
              </Widgets>

              <LargeWidgets>
                <UserTimeline userKey={userKey} userValue={userValue} />
                <ReplayWidget userKey={userKey} userValue={userValue} />
              </LargeWidgets>
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
  padding: ${space(2)} ${space(4)} !important;
`;
const HeaderContent = styled(Layout.HeaderContent)`
  margin: 0;
`;

const ButtonActionsWrapper = styled(Layout.HeaderActions)`
  flex-direction: row;
  justify-content: flex-end;
  align-items: center;
  gap: ${space(2)};
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    margin-bottom: 0;
  }
  font-size: ${p => p.theme.fontSizeLarge};
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

const LargeWidgets = styled(Widgets)`
  overflow: hidden;
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
