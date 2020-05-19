import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';
import omit from 'lodash/omit';

import {Client} from 'app/api';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t} from 'app/locale';
import {defined} from 'app/utils';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';

import Form from './form';
import {submitRule} from './submitRule';
import {handleError} from './handleError';
import {
  RuleType,
  MethodType,
  Rule,
  SourceSuggestion,
  EventId,
  Errors,
  RequestError,
} from './types';

const DEFAULT_RULE_SOURCE_VALUE = '';

type Props = {
  api: Client;
  endpoint: string;
  onClose: () => void;
  onSubmitSuccess?: (rule: Rule) => void;
  onUpdateEventId?: (eventId: string) => void;
  sourceSuggestions?: Array<SourceSuggestion>;
  eventId?: EventId;
  rule?: Rule;
  disabled?: boolean;
};

type State = {
  rule: Rule;
  isFormValid: boolean;
  errors: Errors;
};

class Dialog extends React.Component<Props, State> {
  state: State = {
    rule: {
      id: defined(this.props.rule?.id) ? this.props.rule?.id! : -1,
      type: this.props.rule?.type || RuleType.CREDITCARD,
      method: this.props.rule?.method || MethodType.MASK,
      source: this.props.rule?.source || DEFAULT_RULE_SOURCE_VALUE,
      customRegex: this.props.rule?.customRegex,
    },
    isFormValid: false,
    errors: {},
  };

  clearError = (error: keyof Errors) => {
    this.setState(prevState => ({
      errors: omit(prevState.errors, error),
    }));
  };

  convertRequestError = (error: ReturnType<typeof handleError>) => {
    switch (error.type) {
      case RequestError.InvalidSelector:
        this.setState(prevState => ({
          errors: {
            ...prevState.errors,
            source: error.message,
          },
        }));
        break;
      case RequestError.RegexParse:
        this.setState(prevState => ({
          errors: {
            ...prevState.errors,
            customRegex: error.message,
          },
        }));
        break;
      default:
        addErrorMessage(error.message);
    }
  };

  handleChange = <T extends keyof Omit<Rule, 'id'>>(stateProperty: T, value: Rule[T]) => {
    const rule: Rule = {
      ...this.state.rule,
      [stateProperty]: value,
    };

    if (rule.type !== RuleType.PATTERN) {
      delete rule?.customRegex;
      this.clearError('customRegex');
    }

    if (stateProperty === 'customRegex' || stateProperty === 'source') {
      this.clearError(stateProperty as keyof Omit<Rule, 'id'>);
    }

    this.setState(
      {
        rule,
      },
      this.handleValidateForm
    );
  };

  handleValidation = <T extends keyof Errors>(field: T) => () => {
    const isFieldValueEmpty = !this.state.rule[field];
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

  handleValidateForm = () => {
    const {rule} = this.state;

    const ruleKeys = Object.keys(omit(rule, 'id'));
    const isFormValid = !ruleKeys.find(ruleKey => !rule[ruleKey]);

    this.setState({
      isFormValid,
    });
  };

  handleSave = async () => {
    const {rule} = this.state;
    const {onSubmitSuccess, api, onClose, endpoint} = this.props;

    try {
      const data = await submitRule(api, endpoint, rule);

      addSuccessMessage(t('Successfully saved rule'));

      if (onSubmitSuccess) {
        onSubmitSuccess(data);
      }

      onClose();
    } catch (error) {
      this.convertRequestError(handleError(error));
    }
  };

  render() {
    const {onClose, disabled, sourceSuggestions, onUpdateEventId, eventId} = this.props;
    const {rule, isFormValid, errors} = this.state;

    return (
      <React.Fragment>
        <Modal.Header closeButton>
          {rule?.id !== -1 ? t('Edit a data privacy rule') : t('Add a data privacy rule')}
        </Modal.Header>
        <Modal.Body>
          <Form
            onChange={this.handleChange}
            onValidate={this.handleValidation}
            sourceSuggestions={sourceSuggestions}
            rule={rule}
            disabled={disabled}
            onUpdateEventId={onUpdateEventId}
            eventId={eventId}
            errors={errors}
          />
        </Modal.Body>
        <Modal.Footer>
          <ButtonBar gap={1.5}>
            <Button disabled={disabled} onClick={onClose}>
              {t('Cancel')}
            </Button>
            <Button
              disabled={disabled || !isFormValid}
              onClick={this.handleSave}
              priority="primary"
            >
              {t('Save Rule')}
            </Button>
          </ButtonBar>
        </Modal.Footer>
      </React.Fragment>
    );
  }
}

export {Dialog};
