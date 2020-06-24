import React from 'react';
import omit from 'lodash/omit';
import isEqual from 'lodash/isEqual';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import {t} from 'app/locale';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Organization, Project} from 'app/types';

import {
  RuleType,
  MethodType,
  Rule,
  ProjectId,
  KeysOfUnion,
  EventIdStatus,
} from '../types';
import submitRules from '../submitRules';
import Form from './form';
import Modal from './modal';
import handleError from './handleError';
import {valueSuggestions} from '../utils';
import {fetchSourceGroupData, saveToSourceGroupData} from './utils';

type FormProps = React.ComponentProps<typeof Form>;
type Values = FormProps['values'];
type EventId = NonNullable<FormProps['eventId']>;
type SourceSuggestions = FormProps['sourceSuggestions'];

type Props<T extends ProjectId> = ModalRenderProps & {
  onSubmitSuccess: (data: T extends undefined ? Organization : Project) => void;
  orgSlug: Organization['slug'];
  api: Client;
  endpoint: string;
  savedRules: Array<Rule>;
  projectId?: T;
};

type State = {
  values: Values;
  requiredValues: Array<keyof Values>;
  errors: FormProps['errors'];
  isFormValid: boolean;
  title: string;
  sourceSuggestions: SourceSuggestions;
  eventId: EventId;
};

class ModalManager<
  T extends ProjectId = undefined,
  P extends Props<T> = Props<T>,
  S extends State = State
> extends React.Component<P, S> {
  state = this.getDefaultState();

  componentDidMount() {
    this.handleValidateForm();
  }

  componentDidUpdate(_prevProps: Props<T>, prevState: S) {
    if (!isEqual(prevState.values, this.state.values)) {
      this.handleValidateForm();
    }

    if (prevState.eventId.value !== this.state.eventId.value) {
      this.loadSourceSuggestions();
    }
    if (prevState.eventId.status !== this.state.eventId.status) {
      saveToSourceGroupData(this.state.eventId, this.state.sourceSuggestions);
    }
  }

  getDefaultState(): Readonly<S> {
    const values: Values = {
      type: RuleType.CREDITCARD,
      method: MethodType.MASK,
      source: '',
      placeholder: '',
      pattern: '',
    };
    const {eventId, sourceSuggestions} = fetchSourceGroupData();
    return {
      values,
      requiredValues: this.getRequiredValues(values),
      errors: {},
      isFormValid: false,
      title: this.getTitle(),
      eventId: {
        value: eventId,
        status: !eventId ? EventIdStatus.UNDEFINED : EventIdStatus.LOADED,
      },
      sourceSuggestions,
    } as Readonly<S>;
  }

  getTitle(): string {
    return '';
  }

  getNewRules(): Array<Rule> {
    // Child has to implement this
    throw new Error('Not implemented');
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
      const query: {projectId?: string; eventId: string} = {eventId: eventId.value};
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
      case 'invalid-selector':
        this.setState(prevState => ({
          errors: {
            ...prevState.errors,
            source: error.message,
          },
        }));
        break;
      case 'regex-parse':
        this.setState(prevState => ({
          errors: {
            ...prevState.errors,
            pattern: error.message,
          },
        }));
        break;
      default:
        addErrorMessage(error.message);
    }
  }

  handleChange = <R extends Rule, K extends KeysOfUnion<R>>(field: K, value: R[K]) => {
    const values = {
      ...this.state.values,
      [field]: value,
    };

    if (values.type !== RuleType.PATTERN && values.pattern) {
      values.pattern = '';
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

  handleSave = async () => {
    const {endpoint, api, onSubmitSuccess, closeModal} = this.props;
    const newRules = this.getNewRules();

    try {
      const data = await submitRules(api, endpoint, newRules);
      onSubmitSuccess(data);
      closeModal();
    } catch (error) {
      this.convertRequestError(handleError(error));
    }
  };

  handleValidateForm() {
    const {values, requiredValues} = this.state;
    const isFormValid = requiredValues.every(requiredValue => !!values[requiredValue]);
    this.setState({isFormValid});
  }

  handleValidate = <K extends keyof Values>(field: K) => () => {
    const isFieldValueEmpty = !this.state.values[field].trim();

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
    const {values, errors, title, isFormValid, eventId, sourceSuggestions} = this.state;
    return (
      <Modal
        {...this.props}
        title={title}
        onSave={this.handleSave}
        disabled={!isFormValid}
        content={
          <Form
            onChange={this.handleChange}
            onValidate={this.handleValidate}
            onUpdateEventId={this.handleUpdateEventId}
            eventId={eventId}
            errors={errors}
            values={values}
            sourceSuggestions={sourceSuggestions}
          />
        }
      />
    );
  }
}

export default ModalManager;
