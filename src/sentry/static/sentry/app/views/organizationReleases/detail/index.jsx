import PropTypes from 'prop-types';
import React from 'react';
import {pick} from 'lodash';

import SentryTypes from 'app/sentryTypes';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {URL_PARAM} from 'app/components/organizations/globalSelectionHeader/constants';
import withOrganization from 'app/utils/withOrganization';
import AsyncView from 'app/views/asyncView';
import {PageContent} from 'app/styles/organization';

import ReleaseHeader from './releaseHeader';

class OrganizationReleaseDetailsContainer extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  render() {
    return (
      <React.Fragment>
        <GlobalSelectionHeader organization={this.props.organization} />
        <OrganizationReleaseDetails {...this.props} />
      </React.Fragment>
    );
  }
}

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
    const {
      params: {version},
      organization,
    } = this.props;
    return `Release ${version} | ${organization.slug}`;
  }

  getEndpoints() {
    const {orgId, version} = this.props.params;
    return [
      ['release', `/organizations/${orgId}/releases/${encodeURIComponent(version)}/`],
    ];
  }

  renderBody() {
    const {
      location,
      params: {orgId},
    } = this.props;
    const {release} = this.state;

    const query = pick(location.query, Object.values(URL_PARAM));

    if (this.state.loading) {
      return <LoadingIndicator />;
    }
    if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    return (
      <PageContent>
        <ReleaseHeader release={release} orgId={orgId} />
        {React.cloneElement(this.props.children, {
          release,
          query,
        })}
      </PageContent>
    );
  }
}

export default withOrganization(OrganizationReleaseDetailsContainer);
