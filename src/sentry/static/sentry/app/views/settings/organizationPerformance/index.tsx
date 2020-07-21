import React from 'react';

import {addErrorMessage} from 'app/actionCreators/indicator';
import AsyncView from 'app/views/asyncView';
import {t} from 'app/locale';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import {JsonFormObject} from 'app/views/settings/components/forms/type';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import PermissionAlert from 'app/views/settings/organization/permissionAlert';
import withOrganization from 'app/utils/withOrganization';
import {Organization} from 'app/types';

const fields: JsonFormObject[] = [
  {
    title: t('General'),
    fields: [
      {
        name: 'apdexThreshold',
        type: 'number',
        required: true,
        label: t('Response Time Threshold (Apdex)'),
        help: t(`Set a response time threshold to help define what satisfactory and tolerable
                response times are. This value will be reflected in the calculation of your
                Apdex, a standard measurement in performance.`),
      },
    ],
  },
];

type Props = {
  organization: Organization;
} & AsyncView['props'];

type State = AsyncView['state'];

class OrganizationPerformance extends AsyncView<Props, State> {
  renderBody() {
    const {location, organization} = this.props;
    const features = new Set(organization.features);
    const endpoint = `/organizations/${organization.slug}/`;

    const jsonFormSettings = {
      location,
      features,
      disabled: !(
        organization.access.includes('org:write') && features.has('performance-view')
      ),
    };

    return (
      <React.Fragment>
        <SettingsPageHeader title="Performance" />
        <PermissionAlert />

        <Form
          data-test-id="organization-performance-settings"
          apiMethod="PUT"
          apiEndpoint={endpoint}
          saveOnBlur
          allowUndo
          initialData={organization}
          onSubmitError={() => addErrorMessage('Unable to save changes')}
        >
          <JsonForm {...jsonFormSettings} forms={fields} />
        </Form>
      </React.Fragment>
    );
  }
}

export default withOrganization(OrganizationPerformance);
