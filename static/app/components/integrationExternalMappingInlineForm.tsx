import {Component} from 'react';
import capitalize from 'lodash/capitalize';
import pick from 'lodash/pick';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {ExternalActorMappingOrSuggestion, Integration} from 'sentry/types';
import {
  getExternalActorEndpointDetails,
  isExternalActorMapping,
} from 'sentry/utils/integrationUtil';
import {FieldFromConfig} from 'sentry/views/settings/components/forms';
import Form from 'sentry/views/settings/components/forms/form';
import FormModel from 'sentry/views/settings/components/forms/model';
import {Field} from 'sentry/views/settings/components/forms/type';

type Props = {
  type: 'team' | 'user';
  integration: Integration;
  dataEndpoint: string;
  getBaseFormEndpoint: (mapping: ExternalActorMappingOrSuggestion) => string;
  mapping: ExternalActorMappingOrSuggestion;
  sentryNamesMapper: (v: any) => {id: string; name: string}[];
  onResults?: (mapping: ExternalActorMappingOrSuggestion, data: any) => void;
};

export default class IntegrationExternalMappingInlineForm extends Component<Props> {
  model = new FormModel();

  getInitialData() {
    const {integration, mapping} = this.props;
    return {
      provider: integration.provider.key,
      integrationId: integration.id,
      ...pick(mapping, ['externalName', 'sentryName', 'userId', 'teamId']),
    };
  }

  getField(): Field {
    const {sentryNamesMapper, type, dataEndpoint, onResults, mapping} = this.props;
    const optionMapper = sentryNames =>
      sentryNames.map(({name, id}) => ({value: id, label: name}));

    return {
      name: `${type}Id`,
      type: 'select_async',
      required: true,
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
        onResults?.(mapping, result);
        return optionMapper(sentryNamesMapper(result));
      },
    };
  }
  render() {
    const {type, getBaseFormEndpoint, mapping} = this.props;
    const {apiEndpoint, apiMethod} = getExternalActorEndpointDetails(
      getBaseFormEndpoint(mapping),
      mapping
    );
    return (
      <Form
        requireChanges
        apiEndpoint={apiEndpoint}
        apiMethod={apiMethod}
        onSubmitSuccess={() => addSuccessMessage(t(`External ${type} updated`))}
        onSubmitError={() => addErrorMessage(t(`Couldn't update external ${type}`))}
        saveOnBlur
        allowUndo
        initialData={this.getInitialData()}
        model={this.model}
      >
        <FieldFromConfig
          key={`${type}Id`}
          field={this.getField()}
          inline={false}
          stacked
          // We need to submit the entire model since it could be a new one or an update
          getData={() => this.model.getData()}
          onBlur={value => {
            const updatedMapping = {...mapping, [`${type}Id`]: value};
            // This is necessary since the endpoint changes depending on the value selected
            const endpointDetails = getExternalActorEndpointDetails(
              getBaseFormEndpoint(updatedMapping),
              updatedMapping
            );
            this.model.setFormOptions({...this.model.options, ...endpointDetails});
          }}
        />
      </Form>
    );
  }
}
