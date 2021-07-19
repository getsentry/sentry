import {Component} from 'react';
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
    type: 'user' | 'team';
    baseEndpoint?: string;
    sentryNamesMapper: (v: any) => {id: string; name: string}[];
    url: string;
    onResults?: (data: any) => void;
  };

export default class IntegrationExternalMappingForm extends Component<Props> {
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
    const {type, sentryNamesMapper, url, mapping} = this.props;
    const optionMapper = sentryNames =>
      sentryNames.map(({name, id}) => ({value: id, label: name}));

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
        type: 'select_async',
        required: true,
        label: tct('Sentry [type]', {type: capitalize(type)}),
        placeholder: t(`Choose your Sentry User`),
        url,
        onResults: result => {
          // For organizations with >100 users, we want to make sure their
          // saved mapping gets populated in the results if it wouldn't have
          // been in the initial 100 API results, which is why we add it here
          if (mapping && !result.find(({user}) => user.id === mapping.userId)) {
            result = [{id: mapping.userId, name: mapping.sentryName}, ...result];
          }
          this.props.onResults?.(result);
          return optionMapper(sentryNamesMapper(result));
        },
      });
    }
    if (type === 'team') {
      fields.push({
        name: 'teamId',
        type: 'select_async',
        required: true,
        label: tct('Sentry [type]', {type: capitalize(type)}),
        placeholder: t(`Choose your Sentry Team`),
        url,
        onResults: result => {
          // For organizations with >100 teams, we want to make sure their
          // saved mapping gets populated in the results if it wouldn't have
          // been in the initial 100 API results, which is why we add it here
          if (mapping && !result.find(({id}) => id === mapping.teamId)) {
            result = [{id: mapping.teamId, name: mapping.sentryName}, ...result];
          }
          // The team needs `this.props.onResults` so that we have team slug
          // when a user submits a team mapping, the endpoint needs the slug
          // as a path param: /teams/${organization.slug}/${team.slug}/external-teams/
          this.props.onResults?.(result);
          return optionMapper(sentryNamesMapper(result));
        },
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
