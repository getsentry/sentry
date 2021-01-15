import React from 'react';

import {t} from 'app/locale';
import {Organization} from 'app/types';
import {DynamicSamplingRules, DynamicSamplingRuleType} from 'app/types/dynamicSampling';
import AsyncView from 'app/views/asyncView';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import PermissionAlert from 'app/views/settings/organization/permissionAlert';

import TransactionRules from './transactionRules';

type Props = AsyncView['props'] & {
  organization: Organization;
};

type State = AsyncView['state'] & {
  transactionRules: DynamicSamplingRules;
};

class OrganizationFiltersAndSampling extends AsyncView<Props, State> {
  getTitle() {
    return t('Filters & Sampling');
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      transactionRules: [],
    };
  }

  componentDidMount() {
    this.getTransactionsRules();
  }

  getTransactionsRules() {
    const {organization} = this.props;
    const {dynamicSampling} = organization;

    const transactionRules = dynamicSampling.filter(
      rule => rule.ty !== DynamicSamplingRuleType.ERROR
    );

    this.setState({transactionRules});
  }

  handleAddRule = () => {
    // TODO(Priscila): Implement the request here
  };

  render() {
    const {transactionRules} = this.state;

    return (
      <React.Fragment>
        <SettingsPageHeader title={this.getTitle()} />
        <PermissionAlert />
        <TextBlock>
          {t(
            'Manage the inbound data you want to store. To change the sampling rate or rate limits, update your SDK configuration. The rules added below will apply on top of your SDK configuration.'
          )}
        </TextBlock>
        <TransactionRules rules={transactionRules} onAddRule={this.handleAddRule} />
      </React.Fragment>
    );
  }
}

export default OrganizationFiltersAndSampling;
