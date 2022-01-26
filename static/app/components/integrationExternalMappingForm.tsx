import {Component} from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import {SelectAsyncControlProps} from 'sentry/components/forms/selectAsyncControl';
import {t, tct} from 'sentry/locale';
import {
  ExternalActorMapping,
  ExternalActorMappingOrSuggestion,
  Integration,
} from 'sentry/types';
import {
  getExternalActorEndpointDetails,
  isExternalActorMapping,
  sentryNameToOption,
} from 'sentry/utils/integrationUtil';
import {FieldFromConfig} from 'sentry/views/settings/components/forms';
import Form from 'sentry/views/settings/components/forms/form';
import FormModel from 'sentry/views/settings/components/forms/model';
import {Field} from 'sentry/views/settings/components/forms/type';

type Props = Pick<Form['props'], 'onCancel' | 'onSubmitSuccess' | 'onSubmitError'> &
  Pick<SelectAsyncControlProps, 'defaultOptions'> & {
    integration: Integration;
    mapping?: ExternalActorMappingOrSuggestion;
    type: 'user' | 'team';
    getBaseFormEndpoint: (mapping?: ExternalActorMappingOrSuggestion) => string;
    sentryNamesMapper: (v: any) => {id: string; name: string}[];
    dataEndpoint: string;
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
      ...mapping,
    };
  }

  getDefaultOptions(mapping?: ExternalActorMappingOrSuggestion) {
    const {defaultOptions, type} = this.props;
    if (typeof defaultOptions === 'boolean') {
      return defaultOptions;
    }
    const options = [...(defaultOptions ?? [])];
    if (!mapping || !isExternalActorMapping(mapping)) {
      return options;
    }
    // For organizations with >100 entries, we want to make sure their
    // saved mapping gets populated in the results if it wouldn't have
    // been in the initial 100 API results, which is why we add it here
    const mappingId = mapping[`${type}Id`];
    const mappingOption = options.find(({value}) => mappingId && value === mappingId);
    return !!mappingOption
      ? options
      : [{value: mappingId, label: mapping.sentryName}, ...options];
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
    const fields: Field[] = [
      {
        name: `${type}Id`,
        type: 'select_async',
        required: true,
        label: isInline ? undefined : tct('Sentry [type]', {type: capitalize(type)}),
        placeholder: t(`Select Sentry ${capitalize(type)}`),
        url: dataEndpoint,
        defaultOptions: this.getDefaultOptions(mapping),
        onResults: result => {
          onResults?.(result, isInline ? mapping?.externalName : mappingKey);
          return sentryNamesMapper(result).map(sentryNameToOption);
        },
      },
    ];
    // We only add the field for externalName if it's the full (not inline) form
    if (!isInline) {
      fields.unshift({
        name: 'externalName',
        type: 'string',
        required: true,
        label: isInline ? undefined : tct('External [type]', {type: capitalize(type)}),
        placeholder: type === 'user' ? t('@username') : t('@org/teamname'),
      });
    }
    return fields;
  }

  get extraFormFieldProps() {
    const {isInline} = this.props;
    return isInline
      ? {
          // We need to submit the entire model since it could be a new one or an update
          getData: () => this.model.getData(),
          // We need to update the model onBlur for inline forms since the model's 'onPreSubmit' hook
          // does NOT run when using `saveOnBlur`.
          onBlur: () => this.updateModel(),
        }
      : {flexibleControlStateSize: true};
  }

  // This function is necessary since the endpoint we submit to changes depending on the value selected
  updateModel() {
    const {getBaseFormEndpoint, mapping} = this.props;
    const updatedMapping: ExternalActorMapping = {
      ...mapping,
      ...(this.model.getData() as ExternalActorMapping),
    };
    if (updatedMapping) {
      const endpointDetails = getExternalActorEndpointDetails(
        getBaseFormEndpoint(updatedMapping),
        updatedMapping
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
          onPreSubmit={() => this.updateModel()}
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
