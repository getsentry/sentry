import {Component} from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import {t, tct} from 'sentry/locale';
import {ExternalActorMapping, Integration} from 'sentry/types';
import {getExternalActorEndpointDetails} from 'sentry/utils/integrationUtil';
import {FieldFromConfig} from 'sentry/views/settings/components/forms';
import Form from 'sentry/views/settings/components/forms/form';
import FormModel from 'sentry/views/settings/components/forms/model';
import {Field} from 'sentry/views/settings/components/forms/type';

type Props = Pick<Form['props'], 'onCancel' | 'onSubmitSuccess' | 'onSubmitError'> & {
  integration: Integration;
  mapping?: ExternalActorMapping;
  type: 'user' | 'team';
  getBaseFormEndpoint: (mapping?: ExternalActorMapping) => string;
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
          onResults?.(result, isInline ? mapping?.externalName : mappingKey);
          // TODO(Leander): The code below only fixes the problem when viewed, not when edited
          // Pagination still has bugs for results not on initial return of the query

          // For organizations with >100 entries, we want to make sure their
          // saved mapping gets populated in the results if it wouldn't have
          // been in the initial 100 API results, which is why we add it here
          if (
            mapping &&
            !result.find(entry => {
              const id = type === 'user' ? entry.user.id : entry.id;
              return id === mapping[`${type}Id`];
            })
          ) {
            return optionMapper([
              {id: mapping[`${type}Id`], name: mapping.sentryName},
              ...sentryNamesMapper(result),
            ]);
          }
          return optionMapper(sentryNamesMapper(result));
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
    const mapping = this.model.getData() as ExternalActorMapping;
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
