import React from 'react';

import AsyncView from '../views/asyncView';
import ActivityFeed from '../components/activity/feed';
import OrganizationHomeContainer from '../components/organizations/homeContainer';

import {t} from '../locale';

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
        <h4>{t('Activity')}</h4>
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
