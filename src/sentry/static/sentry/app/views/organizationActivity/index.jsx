import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
import React from 'react';

import {PageContent} from 'app/styles/organization';
import {t} from 'app/locale';
import PageHeading from 'app/components/pageHeading';
import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';

import ActivityFeed from './activityFeed';

class OrganizationActivityContainer extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  render() {
    const {organization, params, location} = this.props;

    return (
      <PageContent>
        <div className="organization-home">
          <OrganizationActivity
            organization={organization}
            params={params}
            location={location}
          />
        </div>
      </PageContent>
    );
  }
}

class OrganizationActivity extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    params: PropTypes.object,
    location: PropTypes.object,
  };

  getEndpoint() {
    return `/organizations/${this.props.params.orgId}/activity/`;
  }

  getTitle() {
    return `Activity - ${this.props.params.orgId}`;
  }

  render() {
    return (
      <DocumentTitle title={this.getTitle()}>
        <React.Fragment>
          <PageHeading withMargins>{t('Activity')}</PageHeading>
          <ActivityFeed
            organization={this.props.organization}
            endpoint={this.getEndpoint()}
            query={{
              per_page: 100,
            }}
            pagination
            location={this.props.location}
          />
        </React.Fragment>
      </DocumentTitle>
    );
  }
}

export default withOrganization(OrganizationActivityContainer);
