import React from 'react';

import AsyncView from 'app/views/asyncView';
import ActivityFeed from 'app/components/activity/feed';
import OrganizationHomeContainer from 'app/components/organizations/homeContainer';
import PageHeading from 'app/components/pageHeading';

import {t} from 'app/locale';

export default class OrganizationActivity extends AsyncView {
  getEndpoint() {
    return `/organizations/${this.props.params.orgId}/activity/`;
  }

  getTitle() {
    return 'Activity';
  }

  render() {
    return (
      <OrganizationHomeContainer>
        <PageHeading withMargins>{t('Activity')}</PageHeading>
        <ActivityFeed
          endpoint={this.getEndpoint()}
          query={{
            per_page: 100,
          }}
          pagination={true}
          {...this.props}
        />
      </OrganizationHomeContainer>
    );
  }
}
