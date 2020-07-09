import React from 'react';

import {t} from 'app/locale';
import Form from 'app/views/settings/components/forms/form';
import TextField from 'app/views/settings/components/forms/textField';
import slugify from 'app/utils/slugify';
import {Organization} from 'app/types';

type Props = {
  organization: Organization;
  onSuccess?: (data: {slug: string}) => void;
  onSubmit?: Form['props']['onSubmit'];
  formProps?: Form['props'];
};

const CreateTeamForm = ({organization, onSuccess, onSubmit, formProps}: Props) => (
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
      onSubmit={onSubmit}
      onSubmitSuccess={data => onSuccess?.(data)}
      requireChanges
      data-test-id="create-team-form"
      {...formProps}
    >
      <TextField
        name="slug"
        label={t('Team Slug')}
        placeholder={t('e.g. operations, web-frontend, desktop')}
        help={t('NO')}
        required
        stacked
        flexibleControlStateSize
        inline={false}
        transformInput={slugify}
      />
    </Form>
  </React.Fragment>
);

export default CreateTeamForm;
