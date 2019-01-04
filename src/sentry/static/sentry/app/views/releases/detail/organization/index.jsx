import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import SentryTypes from 'app/sentryTypes';
import Feature from 'app/components/acl/feature';
import {t} from 'app/locale';
import Alert from 'app/components/alert';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import withOrganization from 'app/utils/withOrganization';
import space from 'app/styles/space';
import AsyncView from 'app/views/asyncView';

import ReleaseHeader from '../shared/releaseHeader';

class OrganizationReleaseDetails extends AsyncView {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  static childContextTypes = {
    release: PropTypes.object,
  };

  getChildContext() {
    return {
      release: this.state.release,
    };
  }

  getTitle() {
    const {params: {version}, organization} = this.props;
    return `Release ${version} | ${organization.slug}`;
  }

  getEndpoints() {
    const {orgId, version} = this.props.params;
    return [
      ['release', `/organizations/${orgId}/releases/${encodeURIComponent(version)}/`],
    ];
  }

  renderNoAccess() {
    return <Alert type="warning">{t("You don't have access to this feature")}</Alert>;
  }

  renderBody() {
    const release = this.state.release;
    const {orgId} = this.props.params;

    if (this.state.loading) return <LoadingIndicator />;
    if (this.state.error) return <LoadingError onRetry={this.fetchData} />;

    return (
      <Content>
        <Feature
          features={['organizations:sentry10']}
          organization={this.props.organization}
          renderDisabled={this.renderNoAccess}
        >
          <ReleaseHeader release={release} orgId={orgId} />
          {React.cloneElement(this.props.children, {
            release,
          })}
        </Feature>
      </Content>
    );
  }
}

export default withOrganization(OrganizationReleaseDetails);

// TODO: refactor as this same component is used in events, release list and user feedback
const Content = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  padding: ${space(2)} ${space(4)} ${space(3)};
  margin-bottom: -20px; /* <footer> has margin-top: 20px; */
`;
