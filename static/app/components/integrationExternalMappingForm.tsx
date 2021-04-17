import React from 'react';
import capitalize from 'lodash/capitalize';
import pick from 'lodash/pick';

import {t, tct} from 'app/locale';
import {ExternalActorMapping, Integration, Organization} from 'app/types';
import {FieldFromConfig} from 'app/views/settings/components/forms';
import Form from 'app/views/settings/components/forms/form';
import {Field} from 'app/views/settings/components/forms/type';

type Props = {
  organization: Organization;
  integration: Integration;
  onSubmitSuccess: Form['props']['onSubmitSuccess'];
  onCancel: Form['props']['onCancel'];
  onSubmit?: Form['props']['onSubmit'];
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
      memberId: '',
      teamId: '',
      sentryName: '',
      provider: integration.provider.key,
      ...pick(mapping, ['externalName', 'memberId', 'sentryName', 'teamId']),
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
        placeholder: t(`External ${capitalize(type)}`),
      },
    ];
    if (type === 'user') {
      fields.push({
        name: 'memberId',
        type: 'select',
        required: true,
        label: tct('Sentry [type]', {type: capitalize(type)}),
        placeholder: t(`Sentry ${capitalize(type)}`),
        options,
        deprecatedSelectControl: false,
      });
    }
    if (type === 'team') {
      fields.push({
        name: 'teamId',
        type: 'select',
        required: true,
        label: tct('Sentry [type]', {type: capitalize(type)}),
        placeholder: t(`Sentry ${capitalize(type)}`),
        options,
        deprecatedSelectControl: false,
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
