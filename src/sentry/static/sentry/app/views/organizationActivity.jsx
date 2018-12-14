import React from 'react';
import styled from 'react-emotion';

import AsyncView from 'app/views/asyncView';
import ActivityFeed from 'app/components/activity/feed';
import OrganizationHomeContainer from 'app/components/organizations/homeContainer';
import PageHeader from 'app/components/pageHeader';
import space from 'app/styles/space';

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
        <StyledPageHeader>{t('Activity')}</StyledPageHeader>
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

const StyledPageHeader = styled(PageHeader)`
  margin-bottom: ${space(3)};
  margin-top: ${space(0.5)};
`;
