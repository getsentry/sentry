import React from 'react';
import {RouteComponentProps} from 'react-router';

import {Client} from 'app/api';
import {Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import Redesign from '../usageStats';

import Container from './container';

type Props = {
  api: Client;
  organization: Organization;
} & RouteComponentProps<{orgId: string}, {}>;

const OrganizationStats = (props: Props) => {
  return props.organization.features.includes('usage-stats-graph') ||
    window.localStorage.getItem('ORG_STATS_REDESIGN') ? (
    <Redesign {...(props as any)} />
  ) : (
    <Container {...props} />
  );
};

export default withApi(withOrganization(OrganizationStats));
