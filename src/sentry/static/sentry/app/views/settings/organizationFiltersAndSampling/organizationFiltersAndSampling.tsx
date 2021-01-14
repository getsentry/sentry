import React from 'react';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import PermissionAlert from 'app/views/settings/organization/permissionAlert';

import TransactionRules from './transactionRules';

type Props = AsyncView['props'];

type State = AsyncView['state'];

class OrganizationFiltersAndSampling extends AsyncView<Props, State> {
  getTitle() {
    return t('Filters & Sampling');
  }

  handleAddRule = () => {
    // TODO(Priscila): Implement the request here
  };

  render() {
    return (
      <React.Fragment>
        <SettingsPageHeader title={this.getTitle()} />
        <PermissionAlert />
        <TextBlock>
          {t(
            'Manage the inbound data you want to store. To change the sampling rate or rate limits, update your SDK configuration. The rules added below will apply on top of your SDK configuration.'
          )}
        </TextBlock>
        <TransactionRules rules={[]} onAddRule={this.handleAddRule} />
      </React.Fragment>
    );
  }
}

export default OrganizationFiltersAndSampling;
