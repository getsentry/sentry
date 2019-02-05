import React from 'react';
import PropTypes from 'prop-types';

import AsyncView from 'app/views/asyncView';
import ActivityFeed from 'app/components/activity/feed';
import OrganizationHomeContainer from 'app/components/organizations/homeContainer';
import PageHeading from 'app/components/pageHeading';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import {PageContent} from 'app/styles/organization';
import withOrganization from 'app/utils/withOrganization';

class OrganizationActivityContainer extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  render() {
    const {organization, params, location} = this.props;
    const hasSentry10 = new Set(organization.features).has('sentry10');

    return hasSentry10 ? (
      <PageContent>
        <div className="organization-home">
          <OrganizationActivity
            organization={organization}
            params={params}
            location={location}
          />
        </div>
      </PageContent>
    ) : (
      <OrganizationHomeContainer>
        <OrganizationActivity
          organization={organization}
          params={params}
          location={location}
        />
      </OrganizationHomeContainer>
    );
  }
}

class OrganizationActivity extends AsyncView {
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

  renderBody() {
    return (
      <React.Fragment>
        <PageHeading withMargins>{t('Activity')}</PageHeading>
        <ActivityFeed
          organization={this.props.organization}
          endpoint={this.getEndpoint()}
          query={{
            per_page: 100,
          }}
          pagination={true}
          location={this.props.location}
        />
      </React.Fragment>
    );
  }
}

export default withOrganization(OrganizationActivityContainer);
