import React from 'react';
import {RouteComponentProps} from 'react-router';

import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

import Redesign from '../usageStats';

import Container from './container';

type Props = {
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

export default withOrganization(OrganizationStats);
