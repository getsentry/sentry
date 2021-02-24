import React from 'react';

import Alert from 'app/components/alert';
import {t} from 'app/locale';
import ConfigStore from 'app/stores/configStore';
import {PageContent} from 'app/styles/organization';

import MobileApp from './mobileApp';

class MobileAppContainer extends React.Component<MobileApp['props']> {
  renderNoAccess() {
    return (
      <PageContent>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </PageContent>
    );
  }

  render() {
    if (!ConfigStore.get('user')?.isStaff) {
      return this.renderNoAccess();
    }

    return <MobileApp {...this.props} />;
  }
}

export default MobileAppContainer;
