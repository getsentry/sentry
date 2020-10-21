import {Component, Fragment} from 'react';
import {Location} from 'history';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import {JsonFormObject} from 'app/views/settings/components/forms/type';
import ExternalLink from 'app/components/links/externalLink';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import PermissionAlert from 'app/views/settings/organization/permissionAlert';
import {updateOrganization} from 'app/actionCreators/organizations';
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
        help: tct(
          `Set a response time threshold in milliseconds to help define what satisfactory
                and tolerable response times are. This value will be reflected in the
                calculation of your [link:Apdex], a standard measurement in performance.`,
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/performance-monitoring/performance/metrics/#apdex" />
            ),
          }
        ),
      },
    ],
  },
];

type Props = {
  organization: Organization;
  location: Location;
};

class OrganizationPerformance extends Component<Props> {
  handleSuccess = (data: Organization) => {
    updateOrganization(data);
  };

  render() {
    const {location, organization} = this.props;
    const features = new Set(organization.features);
    const access = new Set(organization.access);
    const endpoint = `/organizations/${organization.slug}/`;

    const jsonFormSettings = {
      location,
      features,
      access,
      disabled: !(access.has('org:write') && features.has('performance-view')),
    };

    return (
      <Fragment>
        <SettingsPageHeader title="Performance" />
        <PermissionAlert />

        <Form
          data-test-id="organization-performance-settings"
          apiMethod="PUT"
          apiEndpoint={endpoint}
          saveOnBlur
          allowUndo
          initialData={organization}
          onSubmitSuccess={this.handleSuccess}
          onSubmitError={() => addErrorMessage('Unable to save changes')}
        >
          <JsonForm {...jsonFormSettings} forms={fields} />
        </Form>
      </Fragment>
    );
  }
}

export default withOrganization(OrganizationPerformance);
