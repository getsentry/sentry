import React from 'react';

import {t} from 'app/locale';
import {Organization} from 'app/types';
import Form from 'app/views/settings/components/forms/form';
import TextField from 'app/views/settings/components/forms/textField';
import slugify from 'app/utils/slugify';

type Payload = {
  slug: string;
};

type Props = {
  organization: Organization;
  onSubmit?: (data: Payload, onSuccess: Function, onError: Function) => void;
  onSuccess?: (data: Payload) => void;
  formProps?: Partial<typeof Form>;
};

export default class CreateTeamForm extends React.Component<Props> {
  handleSubmit = (data: Record<string, any>, onSuccess, onError) => {
    const {onSubmit} = this.props;
    if (typeof onSubmit !== 'function') {
      return;
    }

    onSubmit(data as Payload, onSuccess, onError);
  };

  handleCreateTeamSuccess = (data: Payload) => {
    const {onSuccess} = this.props;

    if (typeof onSuccess !== 'function') {
      return;
    }

    onSuccess(data);
  };

  render() {
    const {organization} = this.props;

    return (
      <React.Fragment>
        <p>
          {t(
            'Members of a team have access to specific areas, such as a new release or a new application feature.'
          )}
        </p>

        <Form
          submitLabel={t('Create Team')}
          apiEndpoint={`/organizations/${organization.slug}/teams/`}
          apiMethod="POST"
          onSubmit={this.handleSubmit}
          onSubmitSuccess={this.handleCreateTeamSuccess}
          requireChanges
          data-test-id="create-team-form"
          {...this.props.formProps}
        >
          <TextField
            name="slug"
            label={t('Team Name')}
            placeholder={t('e.g. operations, web-frontend, desktop')}
            help={t('May contain lowercase letters, numbers, dashes and underscores.')}
            required
            stacked
            flexibleControlStateSize
            inline={false}
            transformInput={slugify}
          />
        </Form>
      </React.Fragment>
    );
  }
}
