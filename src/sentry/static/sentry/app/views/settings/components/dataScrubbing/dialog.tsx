import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';
import styled from '@emotion/styled';
import omit from 'lodash/omit';
import isEqual from 'lodash/isEqual';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t} from 'app/locale';
import {defined} from 'app/utils';

import Form from './form/form';
import {
  RuleType,
  MethodType,
  EventId,
  SourceSuggestion,
  Rule,
  Errors,
  KeysOfUnion,
} from './types';

const DEFAULT_RULE_SOURCE_VALUE = '';

type Props = {
  onClose: () => void;
  onSaveRule: (rule: Rule) => void;
  errors: Errors;
  onUpdateEventId?: (eventId: string) => void;
  sourceSuggestions?: Array<SourceSuggestion>;
  eventId?: EventId;
  rule?: Rule;
};

type State = {
  rule: Rule;
  isFormValid: boolean;
  errors: Errors;
  isNewRule: boolean;
};

class Dialog extends React.Component<Props, State> {
  state: State = {
    rule: {
      id: -1,
      type: RuleType.CREDITCARD,
      method: MethodType.MASK,
      source: DEFAULT_RULE_SOURCE_VALUE,
    },
    isNewRule: !defined(this.props.rule?.id),
    isFormValid: false,
    errors: {},
  };

  componentDidMount() {
    this.loadRule();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (!isEqual(prevProps.errors, this.props.errors)) {
      this.updateErrors();
    }

    if (this.props.rule && this.props.rule.id !== prevState.rule.id) {
      return;
    }

    if (!isEqual(prevState.rule, this.state.rule)) {
      this.handleValidateForm();
    }
  }

  loadRule = () => {
    const rule = this.props.rule;
    if (!rule) {
      return;
    }
    this.setState({rule});
  };

  updateErrors = () => {
    this.setState(prevState => ({errors: {...prevState.errors, ...this.props.errors}}));
  };

  clearError = (error: keyof Errors) => {
    this.setState(prevState => ({errors: omit(prevState.errors, error)}));
  };

  handleChange = <R extends Rule, K extends KeysOfUnion<R>>(
    stateProperty: K,
    value: R[K]
  ) => {
    const rule: Rule = {...this.state.rule, [stateProperty]: value};

    if (rule.type === RuleType.PATTERN) {
      rule.pattern = rule?.pattern || '';
    }

    if (rule.type !== RuleType.PATTERN) {
      // TODO(Priscila): Improve this logic
      // @ts-ignore
      delete rule?.pattern;
      this.clearError('pattern');
    }

    if (stateProperty === 'pattern' || stateProperty === 'source') {
      this.clearError(stateProperty);
    }

    this.setState({rule});
  };

  handleValidation = <T extends keyof Errors>(field: T) => () => {
    // @ts-ignore
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

    this.setState({isFormValid});
  };

  handleSave = () => {
    const {rule} = this.state;
    const {onSaveRule} = this.props;
    onSaveRule(rule);
  };

  render() {
    const {onClose, sourceSuggestions, onUpdateEventId, eventId} = this.props;
    const {rule, isFormValid, errors, isNewRule} = this.state;

    return (
      <StyledModal show animation={false} onHide={onClose}>
        <Modal.Header closeButton>
          {isNewRule
            ? t('Add an advanced data scrubbing rule')
            : t('Edit an advanced data scrubbing rule')}
        </Modal.Header>
        <Modal.Body>
          <Form
            onChange={this.handleChange}
            onValidate={this.handleValidation}
            sourceSuggestions={sourceSuggestions}
            rule={rule}
            onUpdateEventId={onUpdateEventId}
            eventId={eventId}
            errors={errors}
          />
        </Modal.Body>
        <Modal.Footer>
          <ButtonBar gap={1.5}>
            <Button onClick={onClose}>{t('Cancel')}</Button>
            <Button disabled={!isFormValid} onClick={this.handleSave} priority="primary">
              {t('Save Rule')}
            </Button>
          </ButtonBar>
        </Modal.Footer>
      </StyledModal>
    );
  }
}

export default Dialog;

const StyledModal = styled(Modal)`
  .modal-dialog {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) !important;
    margin: 0;
    @media (max-width: ${p => p.theme.breakpoints[0]}) {
      width: 100%;
    }
  }
  .close {
    outline: none;
  }
`;
