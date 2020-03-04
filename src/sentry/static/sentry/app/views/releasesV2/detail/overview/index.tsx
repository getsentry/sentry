import React from 'react';
import styled from '@emotion/styled';
import {Params} from 'react-router/lib/Router';

import withOrganization from 'app/utils/withOrganization';
import {Organization} from 'app/types';

import HealthChart from './healthChart';
import Issues from './issues';
import CommitAuthorBreakdown from './commitAuthorBreakdown';
import ProjectReleaseDetails from './projectReleaseDetails';
import TotalCrashFreeUsers from './totalCrashFreeUsers';

type Props = {
  organization: Organization;
  params: Params;
};

const ReleaseOverview = ({organization, params}: Props) => {
  return (
    <React.Fragment>
      <Main>
        <HealthChart />
        <Issues orgId={organization.slug} version={params.release} />
      </Main>
      <Sidebar>
        <CommitAuthorBreakdown />
        <ProjectReleaseDetails />
        <TotalCrashFreeUsers />
      </Sidebar>
    </React.Fragment>
  );
};

const Main = styled('div')`
  grid-column: 1 / 2;
`;
const Sidebar = styled('div')`
  grid-column: 2 / 3;
`;

export default withOrganization(ReleaseOverview);
