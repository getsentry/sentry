import React from 'react';
import styled from 'react-emotion';

import AsyncView from 'app/views/asyncView';
import ActivityFeed from 'app/components/activity/feed';
import OrganizationHomeContainer from 'app/components/organizations/homeContainer';
import PageHeading from 'app/components/pageHeading';

import {t} from 'app/locale';
import space from 'app/styles/space';

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
        <StyledPageHeading>{t('Activity')}</StyledPageHeading>
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

const StyledPageHeading = styled(PageHeading)`
  margin-top: ${space(0.25)};
  margin-bottom: 24px;
`;
