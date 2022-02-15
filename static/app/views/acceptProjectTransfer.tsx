import {RouteComponentProps} from 'react-router';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Form from 'sentry/components/forms/form';
import SelectField from 'sentry/components/forms/selectField';
import NarrowLayout from 'sentry/components/narrowLayout';
import {t, tct} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

type Props = RouteComponentProps<{}, {}>;

type TransferDetails = {
  organizations: Organization[];
  project: Project;
};

type State = {
  transferDetails: TransferDetails | null;
} & AsyncView['state'];

class AcceptProjectTransfer extends AsyncView<Props, State> {
  disableErrorReport = false;

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const query = this.props.location.query;
    return [['transferDetails', '/accept-transfer/', {query}]];
  }

  getTitle() {
    return t('Accept Project Transfer');
  }

  handleSubmit = formData => {
    this.api.request('/accept-transfer/', {
      method: 'POST',
      data: {
        data: this.props.location.query.data,
        organization: formData.organization,
      },
      success: () => {
        const orgSlug = formData.organization;

        this.props.router.push(`/${orgSlug}`);
        addSuccessMessage(t('Project successfully transferred'));
      },
      error: error => {
        const errorMsg =
          error && error.responseJSON && typeof error.responseJSON.detail === 'string'
            ? error.responseJSON.detail
            : '';

        addErrorMessage(
          t('Unable to transfer project') + errorMsg ? `: ${errorMsg}` : ''
        );
      },
    });
  };

  renderError(error) {
    let disableLog = false;
    // Check if there is an error message with `transferDetails` endpoint
    // If so, show as toast and ignore, otherwise log to sentry
    if (error && error.responseJSON && typeof error.responseJSON.detail === 'string') {
      addErrorMessage(error.responseJSON.detail);
      disableLog = true;
    }

    return super.renderError(error, disableLog);
  }

  renderBody() {
    const {transferDetails} = this.state;
    const options = transferDetails?.organizations.map(org => ({
      label: org.slug,
      value: org.slug,
    }));
    const organization = options?.[0]?.value;

    return (
      <NarrowLayout>
        <SettingsPageHeader title={t('Approve Transfer Project Request')} />
        <p>
          {tct(
            'Projects must be transferred to a specific [organization]. ' +
              'You can grant specific teams access to the project later under the [projectSettings]. ' +
              '(Note that granting access to at least one team is necessary for the project to ' +
              'appear in all parts of the UI.)',
            {
              organization: <strong>{t('Organization')}</strong>,
              projectSettings: <strong>{t('Project Settings')}</strong>,
            }
          )}
        </p>
        {transferDetails && (
          <p>
            {tct(
              'Please select which [organization] you want for the project [project].',
              {
                organization: <strong>{t('Organization')}</strong>,
                project: transferDetails.project.slug,
              }
            )}
          </p>
        )}
        <Form
          onSubmit={this.handleSubmit}
          submitLabel={t('Transfer Project')}
          submitPriority="danger"
          initialData={organization ? {organization} : undefined}
        >
          <SelectField
            options={options}
            label={t('Organization')}
            name="organization"
            style={{borderBottom: 'none'}}
          />
        </Form>
      </NarrowLayout>
    );
  }
}

export default AcceptProjectTransfer;
