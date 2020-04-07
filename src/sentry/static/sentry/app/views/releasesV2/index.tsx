import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';

import {Organization} from 'app/types';
import SentryTypes from 'app/sentryTypes';
import Feature from 'app/components/acl/feature';
import withOrganization from 'app/utils/withOrganization';

import {switchReleasesVersion} from './utils';

type RouteParams = {
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
};

class ReleasesContainer extends React.Component<Props> {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
  };

  componentDidMount() {
    const {organization} = this.props;

    if (!organization.features.includes('releases-v2')) {
      switchReleasesVersion('1', this.props.organization.id);
      location.reload();
    }
  }

  renderNoAccess() {
    // we will redirect to v1
    return <Blank />;
  }

  render() {
    const {organization, children} = this.props;

    return (
      <Feature
        features={['releases-v2']}
        organization={organization}
        renderDisabled={this.renderNoAccess}
      >
        {children}
      </Feature>
    );
  }
}

const Blank = styled('div')`
  height: 100vh;
`;

export default withOrganization(ReleasesContainer);
