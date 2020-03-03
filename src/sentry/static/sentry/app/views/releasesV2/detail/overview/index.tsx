import React from 'react';
import styled from '@emotion/styled';
import {Params} from 'react-router/lib/Router';

import HealthChart from './healthChart';
import Issues from './issues';
import withOrganization from 'app/utils/withOrganization';
import {Organization} from 'app/types';

import CommitAuthorBreakdown from './commitAuthorBreakdown';
import ProjectReleaseDetails from './projectReleaseDetails';

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
