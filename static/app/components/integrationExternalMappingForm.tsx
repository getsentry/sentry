import React from 'react';
import capitalize from 'lodash/capitalize';
import pick from 'lodash/pick';

import {t, tct} from 'app/locale';
import {ExternalActorMapping, Integration, Organization} from 'app/types';
import {FieldFromConfig} from 'app/views/settings/components/forms';
import Form from 'app/views/settings/components/forms/form';
import {Field} from 'app/views/settings/components/forms/type';

type Props = Pick<Form['props'], 'onSubmitSuccess' | 'onCancel'> &
  Partial<Pick<Form['props'], 'onSubmit'>> & {
    organization: Organization;
    integration: Integration;
    mapping?: ExternalActorMapping;
    sentryNames: {id: string; name: string}[];
    type: 'user' | 'team';
    baseEndpoint?: string;
  };

export default class IntegrationExternalMappingForm extends React.Component<Props> {
  get initialData() {
    const {integration, mapping} = this.props;

    return {
      externalName: '',
      userId: '',
      teamId: '',
      sentryName: '',
      provider: integration.provider.key,
      integrationId: integration.id,
      ...pick(mapping, ['externalName', 'userId', 'sentryName', 'teamId']),
    };
  }

  get formFields(): Field[] {
    const {sentryNames, type} = this.props;
    const options = sentryNames.map(({name, id}) => ({value: id, label: name}));
    const fields: any[] = [
      {
        name: 'externalName',
        type: 'string',
        required: true,
        label: tct('External [type]', {type: capitalize(type)}),
        placeholder: t(`${type === 'team' ? '@org/teamname' : '@username'}`),
      },
    ];
    if (type === 'user') {
      fields.push({
        name: 'userId',
        type: 'select',
        required: true,
        label: tct('Sentry [type]', {type: capitalize(type)}),
        placeholder: t(`Choose your Sentry User`),
        options,
      });
    }
    if (type === 'team') {
      fields.push({
        name: 'teamId',
        type: 'select',
        required: true,
        label: tct('Sentry [type]', {type: capitalize(type)}),
        placeholder: t(`Choose your Sentry Team`),
        options,
      });
    }
    return fields;
  }

  render() {
    const {onSubmitSuccess, onCancel, mapping, baseEndpoint, onSubmit} = this.props;

    // endpoint changes if we are making a new row or updating an existing one
    const endpoint = !baseEndpoint
      ? undefined
      : mapping
      ? `${baseEndpoint}${mapping.id}/`
      : baseEndpoint;
    const apiMethod = !baseEndpoint ? undefined : mapping ? 'PUT' : 'POST';

    return (
      <Form
        onSubmitSuccess={onSubmitSuccess}
        initialData={this.initialData}
        apiEndpoint={endpoint}
        apiMethod={apiMethod}
        onCancel={onCancel}
        onSubmit={onSubmit}
      >
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
