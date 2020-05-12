import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t} from 'app/locale';
import {defined} from 'app/utils';

import DataPrivacyRulesPanelForm from './dataPrivacyRulesForm/dataPrivacyRulesForm';
import {RuleType, MethodType} from './dataPrivacyRulesForm/types';

const DEFAULT_RULE_SOURCE_VALUE = '';

type FormProps = React.ComponentProps<typeof DataPrivacyRulesPanelForm>;
type Rule = FormProps['rule'];
type Errors = FormProps['errors'];

type Props = Pick<
  FormProps,
  'sourceSuggestions' | 'disabled' | 'eventId' | 'onUpdateEventId'
> & {
  rule?: Rule;
  onSaveRule: (rule: Rule) => Promise<{errors: Errors} | undefined>;
  onClose: () => void;
};

type State = {
  rule: Rule;
  isFormValid: boolean;
  errors: Errors;
};

class DataPrivacyRulesModal extends React.Component<Props, State> {
  state = {
    rule: {
      id: defined(this.props.rule?.id) ? this.props.rule?.id! : -1,
      type: this.props.rule?.type || RuleType.CREDITCARD,
      method: this.props.rule?.method || MethodType.MASK,
      source: this.props.rule?.source || DEFAULT_RULE_SOURCE_VALUE,
      customRegularExpression: this.props.rule?.customRegularExpression,
    },
    isFormValid: false,
    errors: {},
  };

  handleChange = (updatedRule: Rule) => {
    this.setState(
      {
        rule: updatedRule,
        errors: {},
      },
      this.handleValidate
    );
  };

  handleValidate = () => {
    const {rule} = this.state;

    const ruleKeys = Object.keys(omit(rule, 'id'));
    const isFormValid = !ruleKeys.find(ruleKey => !rule[ruleKey]);

    this.setState({
      isFormValid,
    });
  };

  handleSave = async () => {
    const {rule} = this.state;
    const {onSaveRule, onClose} = this.props;

    await onSaveRule(rule).then(result => {
      if (!result) {
        onClose();
        return;
      }

      this.setState({
        errors: result.errors,
      });
    });
  };

  render() {
    const {onClose, disabled, sourceSuggestions, onUpdateEventId, eventId} = this.props;
    const {rule, isFormValid, errors} = this.state;

    return (
      <StyledModal show animation={false} onHide={onClose}>
        <Modal.Header closeButton>
          {rule?.id !== -1 ? t('Edit a data privacy rule') : t('Add a data privacy rule')}
        </Modal.Header>
        <Modal.Body>
          <DataPrivacyRulesPanelForm
            onChange={this.handleChange}
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
      </StyledModal>
    );
  }
}

export default DataPrivacyRulesModal;

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
