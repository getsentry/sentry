import {FieldFromConfig} from 'sentry/components/forms';
import Form, {FormProps} from 'sentry/components/forms/form';
import {Field} from 'sentry/components/forms/types';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {Repository} from 'sentry/types';

import Alert from './alert';

type Props = Pick<FormProps, 'onSubmitSuccess' | 'onCancel'> & {
  closeModal: () => void;
  onSubmitSuccess: (data: any) => void;
  orgSlug: string;
  repository: Repository;
};

const formFields: Field[] = [
  {
    name: 'name',
    type: 'string',
    required: true,
    label: t('Name of your repository.'),
  },
  {
    name: 'url',
    type: 'string',
    required: false,
    label: t('Full URL to your repository.'),
    placeholder: t('https://github.com/my-org/my-repo/'),
  },
];

function RepositoryEditForm({
  repository,
  onCancel,
  orgSlug,
  onSubmitSuccess,
  closeModal,
}: Props) {
  const initialData = {
    name: repository.name,
    url: repository.url || '',
  };

  return (
    <Form
      initialData={initialData}
      onSubmitSuccess={data => {
        onSubmitSuccess(data);
        closeModal();
      }}
      apiEndpoint={`/organizations/${orgSlug}/repos/${repository.id}/`}
      apiMethod="PUT"
      onCancel={onCancel}
    >
      <Alert type="warning" showIcon>
        {tct(
          'Changing the [name:repo name] may have consequences if it no longer matches the repo name used when [link:sending commits with releases].',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/product/cli/releases/#sentry-cli-commit-integration" />
            ),
            name: <strong>repo name</strong>,
          }
        )}
      </Alert>
      {formFields.map(field => (
        <FieldFromConfig
          key={field.name}
          field={field}
          inline={false}
          stacked
          flexibleControlStateSize
        />
      ))}
    </Form>
  );
}

export default RepositoryEditForm;
