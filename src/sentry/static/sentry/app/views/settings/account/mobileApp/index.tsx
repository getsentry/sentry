import React from 'react';

import ComingSoon from 'app/components/acl/comingSoon';
import ConfigStore from 'app/stores/configStore';
import {PageContent} from 'app/styles/organization';

import MobileApp from './mobileApp';

class MobileAppContainer extends React.Component<MobileApp['props']> {
  renderNoAccess() {
    return (
      <PageContent>
        <ComingSoon />
      </PageContent>
    );
  }

  render() {
    if (!ConfigStore.get('user')?.isSuperuser) {
      return this.renderNoAccess();
    }

    return <MobileApp {...this.props} />;
  }
}

export default MobileAppContainer;
