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
  onSubmit?: (data: object, onSuccess: Function, onError: Function) => void;
  onSuccess?: (data: Payload) => void;
  formProps?: Partial<typeof Form>;
};

export default class CreateTeamForm extends React.Component<Props> {
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
            "Teams group members' access to a specific focus, e.g. a major product or application that may have sub-projects."
          )}
        </p>

        <Form
          submitLabel={t('Create Team')}
          apiEndpoint={`/organizations/${organization.slug}/teams/`}
          apiMethod="POST"
          onSubmit={this.props.onSubmit}
          onSubmitSuccess={this.handleCreateTeamSuccess}
          requireChanges
          data-test-id="create-team-form"
          {...this.props.formProps}
        >
          <TextField
            name="slug"
            label={t('Team Slug')}
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
