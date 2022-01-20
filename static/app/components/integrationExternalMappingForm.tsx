import {Component} from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';
import pick from 'lodash/pick';

import {t, tct} from 'sentry/locale';
import {ExternalActorMappingOrSuggestion, Integration} from 'sentry/types';
import {
  getExternalActorEndpointDetails,
  isExternalActorMapping,
} from 'sentry/utils/integrationUtil';
import {FieldFromConfig} from 'sentry/views/settings/components/forms';
import Form from 'sentry/views/settings/components/forms/form';
import FormModel from 'sentry/views/settings/components/forms/model';
import {Field} from 'sentry/views/settings/components/forms/type';

type Props = Pick<Form['props'], 'onCancel' | 'onSubmitError' | 'onSubmitSuccess'> & {
  type: 'team' | 'user';
  integration: Integration;
  dataEndpoint: string;
  getBaseFormEndpoint: (mapping?: ExternalActorMappingOrSuggestion) => string;
  mapping?: ExternalActorMappingOrSuggestion;
  sentryNamesMapper: (v: any) => {id: string; name: string}[];
  onResults?: (data: any, mappingKey?: string) => void;
  isInline?: boolean;
  mappingKey?: string;
};

export default class IntegrationExternalMappingForm extends Component<Props> {
  model = new FormModel();

  get initialData() {
    const {integration, mapping} = this.props;
    return {
      provider: integration.provider.key,
      integrationId: integration.id,
      ...pick(mapping, ['externalName', 'sentryName', 'userId', 'teamId']),
    };
  }

  get formFields(): Field[] {
    const {
      dataEndpoint,
      isInline,
      mapping,
      mappingKey,
      onResults,
      sentryNamesMapper,
      type,
    } = this.props;
    const optionMapper = sentryNames =>
      sentryNames.map(({name, id}) => ({value: id, label: name}));
    const fields: Field[] = [
      {
        name: `${type}Id`,
        type: 'select_async',
        required: true,
        label: isInline ? undefined : tct('Sentry [type]', {type: capitalize(type)}),
        placeholder: t(`Select Sentry ${capitalize(type)}`),
        url: dataEndpoint,
        onResults: result => {
          // For organizations with >100 entries, we want to make sure their
          // saved mapping gets populated in the results if it wouldn't have
          // been in the initial 100 API results, which is why we add it here
          if (
            mapping &&
            isExternalActorMapping(mapping) &&
            !result.find(entry => {
              const id = type === 'user' ? entry.user.id : entry.id;
              return id === mapping[`${type}Id`];
            })
          ) {
            result = [{id: mapping[`${type}Id`], name: mapping.sentryName}, ...result];
          }
          onResults?.(result, isInline ? mapping?.externalName : mappingKey);
          return optionMapper(sentryNamesMapper(result));
        },
      },
    ];
    // We only add the field for externalName if it's not an inline form
    if (!isInline) {
      fields.unshift({
        name: 'externalName',
        type: 'string',
        required: true,
        label: isInline ? undefined : tct('External [type]', {type: capitalize(type)}),
        placeholder: t(`${type === 'user' ? '@username' : '@org/teamname'}`),
      });
    }
    return fields;
  }

  get extraFormFieldProps() {
    const {isInline, mapping, type} = this.props;
    return isInline
      ? {
          // We need to submit the entire model since it could be a new one or an update
          getData: () => this.model.getData(),
          // We need to update the model onBlur for inline forms since the model's 'onPreSubmit' hook
          // does NOT run when using `saveOnBlur`.
          onBlur: value => {
            const updatedMapping: ExternalActorMappingOrSuggestion = {
              externalName: '',
              ...mapping,
              [`${type}Id`]: value,
            };
            this.updateModelFromMapping(updatedMapping);
          },
        }
      : {flexibleControlStateSize: true};
  }

  // This function is necessary since the endpoint we submit to changes depending on the value selected
  updateModelFromMapping(mapping?: ExternalActorMappingOrSuggestion) {
    const {getBaseFormEndpoint} = this.props;
    if (mapping) {
      const endpointDetails = getExternalActorEndpointDetails(
        getBaseFormEndpoint(mapping),
        mapping
      );
      this.model.setFormOptions({...this.model.options, ...endpointDetails});
    }
  }

  render() {
    const {isInline, onCancel, onSubmitError, onSubmitSuccess} = this.props;
    return (
      <FormWrapper>
        <Form
          requireChanges
          model={this.model}
          initialData={this.initialData}
          onCancel={onCancel}
          onSubmitSuccess={onSubmitSuccess}
          onSubmitError={onSubmitError}
          saveOnBlur={isInline}
          allowUndo={isInline}
          onPreSubmit={() => {
            const finalMapping = this.model.getData();
            this.updateModelFromMapping(finalMapping as ExternalActorMappingOrSuggestion);
          }}
        >
          {this.formFields.map(field => (
            <FieldFromConfig
              key={field.name}
              field={field}
              inline={false}
              stacked
              {...this.extraFormFieldProps}
            />
          ))}
        </Form>
      </FormWrapper>
    );
  }
}

// Prevents errors from appearing off the modal
const FormWrapper = styled('div')`
  position: relative;
`;
