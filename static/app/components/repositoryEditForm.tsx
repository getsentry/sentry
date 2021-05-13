import React from 'react';

import {IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import {Repository} from 'app/types';
import {FieldFromConfig} from 'app/views/settings/components/forms';
import Form from 'app/views/settings/components/forms/form';
import {Field} from 'app/views/settings/components/forms/type';

import Alert from './alert';

type Props = Pick<Form['props'], 'onSubmitSuccess' | 'onCancel'> & {
  orgSlug: string;
  repository: Repository;
  onSubmitSuccess: (data: any) => void;
  closeModal: () => void;
};

export default class RepositoryEditForm extends React.Component<Props> {
  get initialData() {
    const {repository} = this.props;

    return {
      name: repository.name,
      url: repository.url || '',
    };
  }

  get formFields(): Field[] {
    const fields: any[] = [
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
    return fields;
  }

  render() {
    const {onCancel, orgSlug, repository} = this.props;
    const endpoint = `/organizations/${orgSlug}/repos/${repository.id}/`;
    return (
      <Form
        initialData={this.initialData}
        onSubmitSuccess={data => {
          this.props.onSubmitSuccess(data);
          this.props.closeModal();
        }}
        apiEndpoint={endpoint}
        apiMethod="PUT"
        onCancel={onCancel}
      >
        <Alert type="warning" icon={<IconWarning />}>
          {tct(
            'Changing the [name:repo name] may have consequences if it no longer matches the repo name used when [link:sending commits with releases].',
            {
              link: (
                <a href="https://docs.sentry.io/product/cli/releases/#sentry-cli-commit-integration" />
              ),
              name: <strong>repo name</strong>,
            }
          )}
        </Alert>
        {this.formFields.map(field => (
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
}
