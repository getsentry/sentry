import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t} from 'app/locale';
import {defined} from 'app/utils';

import DataPrivacyRulesPanelForm from './dataPrivacyRulesPanelForm/dataPrivacyRulesPanelForm';
import {RULE_TYPE, METHOD_TYPE} from './utils';

const DEFAULT_RULE_FROM_VALUE = '';

type DataPrivacyRulesPanelFormProps = React.ComponentProps<
  typeof DataPrivacyRulesPanelForm
>;

type Rule = DataPrivacyRulesPanelFormProps['rule'];

type Props = Pick<
  DataPrivacyRulesPanelFormProps,
  'selectorSuggestions' | 'onUpdateEventId' | 'disabled' | 'eventId'
> &
  Partial<Pick<DataPrivacyRulesPanelFormProps, 'rule'>> & {
    onSaveRule: (rule: Rule) => void;
    onClose: () => void;
  };

type State = {
  rule: Rule;
  isFormValid: boolean;
};

class DataPrivacyRulesPanelRuleModal extends React.Component<Props, State> {
  state = {
    rule: {
      id: defined(this.props.rule?.id) ? this.props.rule?.id! : -1,
      type: this.props.rule?.type || RULE_TYPE.CREDITCARD,
      method: this.props.rule?.method || METHOD_TYPE.MASK,
      from: this.props.rule?.from || DEFAULT_RULE_FROM_VALUE,
      customRegularExpression: this.props.rule?.customRegularExpression,
    },
    isFormValid: false,
  };

  handleChange = (updatedRule: Rule) => {
    this.setState(
      {
        rule: updatedRule,
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

  handleSave = () => {
    const {rule} = this.state;
    const {onSaveRule, onClose} = this.props;

    onSaveRule(rule);
    onClose();
  };

  render() {
    const {onClose, disabled, selectorSuggestions, onUpdateEventId, eventId} = this.props;
    const {rule, isFormValid} = this.state;

    return (
      <StyledModal show animation={false} onHide={onClose}>
        <Modal.Header closeButton>
          {t(`${rule?.id !== -1 ? 'Edit' : 'Add'} a data privacy rule`)}
        </Modal.Header>
        <Modal.Body>
          <DataPrivacyRulesPanelForm
            onChange={this.handleChange}
            selectorSuggestions={selectorSuggestions}
            rule={rule}
            disabled={disabled}
            onUpdateEventId={onUpdateEventId}
            eventId={eventId}
          />
        </Modal.Body>
        <Modal.Footer>
          <ButtonBar gap={1.5}>
            <Button disabled={disabled} onClick={onClose} size="small">
              {t('Cancel')}
            </Button>
            <Button
              disabled={disabled || !isFormValid}
              onClick={this.handleSave}
              size="small"
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

export default DataPrivacyRulesPanelRuleModal;

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
