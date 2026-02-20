import {Fragment} from 'react';

import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import {t} from 'sentry/locale';
import type {Organization, Team} from 'sentry/types/organization';
import slugify from 'sentry/utils/slugify';

type Payload = {
  slug: string;
};

type Props = {
  onSubmit: (
    data: Payload,
    onSuccess: (team: Team) => void,
    onError: (team: Team) => void
  ) => void;
  organization: Organization;
};

function CreateTeamForm({organization, onSubmit}: Props) {
  return (
    <Fragment>
      <p>
        {t('Teams group members for issue assignment, ownership, and notifications.')}
      </p>

      <Form
        submitLabel={t('Create Team')}
        apiEndpoint={`/organizations/${organization.slug}/teams/`}
        apiMethod="POST"
        onSubmit={(data, onSuccess, onError) =>
          onSubmit(data as Payload, onSuccess, onError)
        }
        requireChanges
      >
        <TextField
          stacked
          required
          name="slug"
          label={t('Team Slug')}
          transformInput={slugify}
          placeholder={t('e.g. operations, web-frontend, mobile-ios')}
          help={t('Use lowercase letters, numbers, dashes, and underscores.')}
          flexibleControlStateSize
          inline={false}
          autoFocus
        />
      </Form>
    </Fragment>
  );
}

export default CreateTeamForm;
