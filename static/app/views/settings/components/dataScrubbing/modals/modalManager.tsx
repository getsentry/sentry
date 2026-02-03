import {Component} from 'react';
import * as Sentry from '@sentry/react';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import submitRules from 'sentry/views/settings/components/dataScrubbing/submitRules';
import type {
  AttributeResults,
  KeysOfUnion,
  Rule,
} from 'sentry/views/settings/components/dataScrubbing/types';
import {
  AllowedDataScrubbingDatasets,
  EventIdStatus,
  MethodType,
  RuleType,
} from 'sentry/views/settings/components/dataScrubbing/types';
import {
  TraceItemFieldSelector,
  valueSuggestions,
} from 'sentry/views/settings/components/dataScrubbing/utils';

import Form from './form';
import handleError, {ErrorType} from './handleError';
import Modal from './modal';
import {hasCaptureGroups, useSourceGroupData} from './utils';

type FormProps = React.ComponentProps<typeof Form>;
type Values = FormProps['values'];
type EventId = NonNullable<FormProps['eventId']>;
type SourceSuggestions = FormProps['sourceSuggestions'];

export type ModalManagerProps = ModalRenderProps & {
  api: Client;
  attributeResults: AttributeResults;
  endpoint: string;
  onGetNewRules: (values: Values) => Rule[];
  onSubmitSuccess: (data: {relayPiiConfig: string}) => void;
  orgSlug: Organization['slug'];
  savedRules: Rule[];
  title: string;
  initialState?: Partial<Values>;
  projectId?: Project['id'];
};

type ModalManagerWithLocalStorageProps = ModalManagerProps & {
  saveToSourceGroupData: (
    eventId: EventId,
    sourceSuggestions?: SourceSuggestions
  ) => void;
  sourceGroupData: {eventId: string; sourceSuggestions: SourceSuggestions};
};

type State = {
  dataset: AllowedDataScrubbingDatasets;
  errors: FormProps['errors'];
  eventId: EventId;
  isFormValid: boolean;
  requiredValues: Array<keyof Values>;
  sourceSuggestions: SourceSuggestions;
  values: Values;
};

class ModalManager extends Component<ModalManagerWithLocalStorageProps, State> {
  state = this.getDefaultState();

  componentDidMount() {
    this.handleValidateForm();
  }

  componentDidUpdate(_prevProps: ModalManagerWithLocalStorageProps, prevState: State) {
    if (!isEqual(prevState.values, this.state.values)) {
      this.handleValidateForm();
    }

    if (prevState.eventId.value !== this.state.eventId.value) {
      this.loadSourceSuggestions();
    }
    if (prevState.eventId.status !== this.state.eventId.status) {
      this.props.saveToSourceGroupData(this.state.eventId, this.state.sourceSuggestions);
    }
  }

  getDefaultState(): Readonly<State> {
    const {eventId, sourceSuggestions} = this.props.sourceGroupData;
    const values = this.getInitialValues();
    // Create a temporary rule-like object for dataset determination
    const tempRule = {...values, id: 0} as Rule;
    const traceItemFieldSelector = TraceItemFieldSelector.fromRule(tempRule);
    const dataset =
      traceItemFieldSelector?.getDataset() ?? AllowedDataScrubbingDatasets.DEFAULT;

    return {
      values,
      requiredValues: this.getRequiredValues(values),
      dataset,
      errors: {},
      isFormValid: false,
      eventId: {
        value: eventId,
        status: eventId ? EventIdStatus.LOADED : EventIdStatus.UNDEFINED,
      },
      sourceSuggestions,
    } as Readonly<State>;
  }

  getInitialValues() {
    const {initialState} = this.props;
    return {
      type: initialState?.type ?? RuleType.CREDITCARD,
      method: initialState?.method ?? MethodType.MASK,
      source: initialState?.source ?? '',
      placeholder: initialState?.placeholder ?? '',
      pattern: initialState?.pattern ?? '',
      replaceCaptured: initialState?.replaceCaptured ?? false,
    };
  }

  getRequiredValues(values: Values) {
    const {type} = values;
    const requiredValues: Array<KeysOfUnion<Values>> = ['type', 'method', 'source'];

    if (type === RuleType.PATTERN) {
      requiredValues.push('pattern');
    }

    return requiredValues;
  }

  clearError<F extends keyof Values>(field: F) {
    this.setState(prevState => ({
      errors: omit(prevState.errors, field),
    }));
  }

  async loadSourceSuggestions() {
    const {orgSlug, projectId, api} = this.props;
    const {eventId} = this.state;

    if (!eventId.value) {
      this.setState(prevState => ({
        sourceSuggestions: valueSuggestions,
        eventId: {
          ...prevState.eventId,
          status: EventIdStatus.UNDEFINED,
        },
      }));
      return;
    }

    this.setState(prevState => ({
      sourceSuggestions: valueSuggestions,
      eventId: {
        ...prevState.eventId,
        status: EventIdStatus.LOADING,
      },
    }));

    try {
      const query: {eventId: string; projectId?: string} = {eventId: eventId.value};
      if (projectId) {
        query.projectId = projectId;
      }
      const rawSuggestions = await api.requestPromise(
        `/organizations/${orgSlug}/data-scrubbing-selector-suggestions/`,
        {query}
      );
      const sourceSuggestions: SourceSuggestions = rawSuggestions.suggestions;

      if (sourceSuggestions && sourceSuggestions.length > 0) {
        this.setState(prevState => ({
          sourceSuggestions,
          eventId: {
            ...prevState.eventId,
            status: EventIdStatus.LOADED,
          },
        }));
        return;
      }

      this.setState(prevState => ({
        sourceSuggestions: valueSuggestions,
        eventId: {
          ...prevState.eventId,
          status: EventIdStatus.NOT_FOUND,
        },
      }));
    } catch {
      this.setState(prevState => ({
        eventId: {
          ...prevState.eventId,
          status: EventIdStatus.ERROR,
        },
      }));
    }
  }

  convertRequestError(error: ReturnType<typeof handleError>) {
    switch (error.type) {
      case ErrorType.INVALID_SELECTOR:
        this.setState(prevState => ({
          errors: {
            ...prevState.errors,
            source: error.message,
          },
        }));
        break;
      case ErrorType.REGEX_PARSE:
        this.setState(prevState => ({
          errors: {
            ...prevState.errors,
            pattern: error.message,
          },
        }));
        break;
      case ErrorType.ATTRIBUTE_INVALID:
        this.setState(prevState => ({
          errors: {
            ...prevState.errors,
            source: error.message,
          },
        }));
        break;
      default:
        addErrorMessage(error.message);
    }
  }

  handleAttributeError = (message: string) => {
    this.convertRequestError({
      type: ErrorType.ATTRIBUTE_INVALID,
      message,
    });
  };

  handleChange = <R extends Rule, K extends KeysOfUnion<R>>(field: K, value: R[K]) => {
    const values = {
      ...this.state.values,
      [field]: value,
    };

    if (values.type !== RuleType.PATTERN) {
      values.pattern = '';
      values.replaceCaptured = false;
    }

    if (values.type === RuleType.PATTERN && !hasCaptureGroups(values.pattern)) {
      values.replaceCaptured = false;
    }

    if (values.method !== MethodType.REPLACE && values.placeholder) {
      values.placeholder = '';
    }

    this.setState(prevState => ({
      values,
      requiredValues: this.getRequiredValues(values),
      errors: omit(prevState.errors, field),
    }));
  };

  handleChangeDataset = (dataset: AllowedDataScrubbingDatasets) => {
    if (!dataset) {
      Sentry.captureException(new Error('Dataset is required'));
      return;
    }
    this.setState({
      dataset,
    });
  };

  handleSave = async () => {
    const {endpoint, api, onSubmitSuccess, closeModal, onGetNewRules} = this.props;
    const newRules = onGetNewRules(this.state.values);

    try {
      const data = await submitRules(api, endpoint, newRules);
      onSubmitSuccess(data);
      closeModal();
    } catch (error: any) {
      this.convertRequestError(handleError(error));
    }
  };

  handleValidateForm() {
    const {values, requiredValues} = this.state;
    const isFormValid = requiredValues.every(requiredValue => !!values[requiredValue]);
    this.setState({isFormValid});
  }

  handleValidate =
    <K extends keyof Values>(field: K) =>
    () => {
      const value = this.state.values[field];
      if (typeof value !== 'string') {
        return;
      }

      const isFieldValueEmpty = !value.trim();

      const fieldErrorAlreadyExist = this.state.errors[field];

      if (isFieldValueEmpty && fieldErrorAlreadyExist) {
        return;
      }

      if (isFieldValueEmpty && !fieldErrorAlreadyExist) {
        this.setState(prevState => ({
          errors: {
            ...prevState.errors,
            [field]: t('Field Required'),
          },
        }));
        return;
      }

      if (!isFieldValueEmpty && fieldErrorAlreadyExist) {
        this.clearError(field);
      }
    };

  handleUpdateEventId = (eventId: string) => {
    if (eventId === this.state.eventId.value) {
      return;
    }
    this.setState({
      eventId: {value: eventId, status: EventIdStatus.UNDEFINED},
    });
  };

  render() {
    const {values, errors, isFormValid, eventId, sourceSuggestions} = this.state;
    const {title, attributeResults, projectId} = this.props;

    return (
      <Modal
        {...this.props}
        title={title}
        onSave={this.handleSave}
        disabled={!isFormValid}
        content={
          <Form
            dataset={this.state.dataset}
            onChange={this.handleChange}
            onChangeDataset={this.handleChangeDataset}
            onValidate={this.handleValidate}
            onUpdateEventId={this.handleUpdateEventId}
            onAttributeError={this.handleAttributeError}
            eventId={eventId}
            errors={errors}
            values={values}
            sourceSuggestions={sourceSuggestions}
            attributeResults={attributeResults}
            projectId={projectId}
          />
        }
      />
    );
  }
}

function ModalManagerWithLocalStorage(props: ModalManagerProps) {
  const {sourceGroupData, saveToSourceGroupData} = useSourceGroupData();

  return (
    <ModalManager
      {...props}
      sourceGroupData={sourceGroupData}
      saveToSourceGroupData={saveToSourceGroupData}
    />
  );
}

export default ModalManagerWithLocalStorage;
