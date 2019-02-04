import React from 'react';

import AsyncView from 'app/views/asyncView';
import ActivityFeed from 'app/components/activity/feed';
import OrganizationHomeContainer from 'app/components/organizations/homeContainer';
import PageHeading from 'app/components/pageHeading';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import {PageContent} from 'app/styles/organization';

export default class OrganizationActivity extends AsyncView {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };
  getEndpoint() {
    return `/organizations/${this.props.params.orgId}/activity/`;
  }

  getTitle() {
    return `Activity - ${this.props.params.orgId}`;
  }

  renderActivityFeed() {
    return (
      <React.Fragment>
        <PageHeading withMargins>{t('Activity')}</PageHeading>
        <ActivityFeed
          organization={this.context.organization}
          endpoint={this.getEndpoint()}
          query={{
            per_page: 100,
          }}
          pagination={true}
          {...this.props}
        />
      </React.Fragment>
    );
  }

  renderBody() {
    const hasSentry10 = new Set(this.context.organization.features).has('sentry10');

    return hasSentry10 ? (
      <PageContent>
        <div className="organization-home">{this.renderActivityFeed()}</div>
      </PageContent>
    ) : (
      <OrganizationHomeContainer>{this.renderActivityFeed()}</OrganizationHomeContainer>
    );
  }
}
