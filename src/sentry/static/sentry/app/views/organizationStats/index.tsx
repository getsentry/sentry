import React from 'react';
import {RouteComponentProps} from 'react-router';

import {Client} from 'app/api';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

import Container from './container';
import Redesign from './redesign';

type Props = {
  api: Client;
  organization: Organization;
} & RouteComponentProps<{orgId: string}, {}>;

const OrganizationStats = (props: Props) => {
  return props.organization.features.includes('usage-stats-graph') ||
    window.localStorage.getItem('ORG_STATS_REDESIGN') ? (
    <Redesign {...props} />
  ) : (
    <Container {...props} />
  );
};

export default withOrganization(OrganizationStats);
