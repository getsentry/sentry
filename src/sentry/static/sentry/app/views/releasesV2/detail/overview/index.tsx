import React from 'react';
import styled from '@emotion/styled';
import {Params} from 'react-router/lib/Router';

import withOrganization from 'app/utils/withOrganization';
import {Organization} from 'app/types';
import space from 'app/styles/space';

import HealthChart from './healthChart';
import Issues from './issues';
import CommitAuthorBreakdown from './commitAuthorBreakdown';
import ProjectReleaseDetails from './projectReleaseDetails';
import TotalCrashFreeUsers from './totalCrashFreeUsers';
import SessionDuration from './sessionDuration';
import {ReleaseContext} from '../index';

type Props = {
  organization: Organization;
  params: Params;
};

const ReleaseOverview = ({organization, params}: Props) => {
  return (
    <ReleaseContext.Consumer>
      {release => (
        <ContentBox>
          <Main>
            <HealthChart />
            <Issues orgId={organization.slug} version={params.release} />
          </Main>
          <Sidebar>
            <CommitAuthorBreakdown />
            <ProjectReleaseDetails release={release!} />
            <TotalCrashFreeUsers />
            <SessionDuration />
          </Sidebar>
        </ContentBox>
      )}
    </ReleaseContext.Consumer>
  );
};

const ContentBox = styled('div')`
  padding: ${space(4)};
  flex: 1;
  background-color: white;

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    display: grid;
    grid-column-gap: ${space(3)};
    grid-template-columns: minmax(470px, 1fr) minmax(220px, 280px);
  }
`;

const Main = styled('div')`
  grid-column: 1 / 2;
`;
const Sidebar = styled('div')`
  grid-column: 2 / 3;
`;

export default withOrganization(ReleaseOverview);
