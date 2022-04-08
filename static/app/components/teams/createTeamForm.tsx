import {Fragment} from 'react';

import Form from 'sentry/components/forms/form';
import TextField from 'sentry/components/forms/textField';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import slugify from 'sentry/utils/slugify';

type Payload = {
  slug: string;
};

type Props = {
  organization: Organization;
  formProps?: Partial<typeof Form>;
  onSubmit?: (data: Payload, onSuccess: Function, onError: Function) => void;
  onSuccess?: (data: Payload) => void;
};

function CreateTeamForm({organization, formProps, ...props}: Props) {
  return (
    <Fragment>
      <p>
        {t(
          'Members of a team have access to specific areas, such as a new release or a new application feature.'
        )}
      </p>

      <Form
        submitLabel={t('Create Team')}
        apiEndpoint={`/organizations/${organization.slug}/teams/`}
        apiMethod="POST"
        onSubmit={(data, onSuccess, onError) =>
          props.onSubmit?.(data as Payload, onSuccess, onError)
        }
        onSubmitSuccess={data => props.onSuccess?.(data)}
        requireChanges
        data-test-id="create-team-form"
        {...formProps}
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
    </Fragment>
  );
}

export default CreateTeamForm;
