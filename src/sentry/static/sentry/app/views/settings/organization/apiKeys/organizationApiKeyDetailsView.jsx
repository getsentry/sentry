import {browserHistory} from 'react-router';
import React from 'react';

import {API_SCOPES} from '../../../../constants';
import {t} from '../../../../locale';
import ApiForm from '../../../../components/forms/apiForm';
import IndicatorStore from '../../../../stores/indicatorStore';
import MultipleCheckboxField from '../../../../components/forms/multipleCheckboxField';
import OrganizationSettingsView from '../../../organizationSettingsView';
import SentryTypes from '../../../../proptypes';
import SplitLayout from '../../../../components/splitLayout';
import TextField from '../../../../components/forms/textField';
import TextareaField from '../../../../components/forms/textareaField';
import recreateRoute from '../../../../utils/recreateRoute';

const API_CHOICES = API_SCOPES.map(s => [s, s]);

class OrganizationApiKeyDetailsView extends OrganizationSettingsView {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  getDefaultState() {
    return {
      loading: true,
      error: false,
      apiKey: {},
    };
  }

  componentWillReceiveProps(nextProps) {
    if (
      nextProps.location.search !== this.props.location.search ||
      nextProps.params.orgId !== this.props.params.orgId
    ) {
      this.remountComponent();
    }
  }

  getEndpoints() {
    return [
      [
        'apiKey',
        `/organizations/${this.props.params.orgId}/api-keys/${this.props.params.apiKey}/`,
      ],
    ];
  }

  getTitle() {
    let org = this.context.organization;
    return `${org.name} Edit API Key`;
  }

  handleSubmitSuccess = () => {
    IndicatorStore.add(t('Saved changes'), 'success');
  };

  handleSubmitError = () => {
    IndicatorStore.add(t('Unable to save changes. Please try again.'), 'error');
  };

  renderBody() {
    return (
      <div>
        <div className="page-header">
          <h3>{t('Edit Api Key')}</h3>
        </div>

        <ApiForm
          apiMethod="PUT"
          apiEndpoint={`/organizations/${this.props.params.orgId}/api-keys/${this.props
            .params.apiKey}/`}
          initialData={this.state.apiKey}
          onSubmitSuccess={this.handleSubmitSuccess}
          onSubmitError={this.handleSubmitError}
          onCancel={() =>
            browserHistory.push(
              recreateRoute('api-keys/', {
                stepBack: -1,
                routes: this.props.routes,
                params: this.props.params,
              })
            )}
        >
          <SplitLayout splitWidth={15}>
            <TextField label={t('Label')} name="label" />
            <TextField label={t('API Key')} name="key" disabled />
          </SplitLayout>

          <MultipleCheckboxField
            className="api-key-details"
            name="scope_list"
            label={t('Scopes')}
            required
            choices={API_CHOICES}
          />

          <TextareaField
            label={t('Allowed Domains')}
            name="allowed_origins"
            placeholder="e.g. example.com or https://example.com"
            help="Separate multiple entries with a newline"
          />
        </ApiForm>
      </div>
    );
  }
}

export default OrganizationApiKeyDetailsView;
