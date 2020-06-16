import React from 'react';
import isEqual from 'lodash/isEqual';

import {t} from 'app/locale';
import {defined} from 'app/utils';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import {IconWarning} from 'app/icons';

import RulesList from './rulesList';
import Dialog from './dialog';
import {Rule, SourceSuggestion, EventId, Errors} from './types';

type Props = {
  rules: Array<Rule>;
  onUpdateRule: (rule: Rule) => void;
  onDeleteRule: (rulesToBeDeleted: Array<Rule['id']>) => void;
  errors: Errors;
  onUpdateEventId?: (eventId: string) => void;
  disabled?: boolean;
  sourceSuggestions?: Array<SourceSuggestion>;
  eventId?: EventId;
};

type State = {
  editRule?: Rule['id'];
};

class Content extends React.PureComponent<Props, State> {
  state: State = {};

  componentDidUpdate(prevProps: Props) {
    if (
      prevProps.rules.length > 0 &&
      !isEqual(prevProps.rules, this.props.rules) &&
      Object.keys(this.props.errors).length === 0
    ) {
      this.handleCloseEditRuleModal();
    }
  }

  handleDeleteRule = (ruleId: Rule['id']) => () => {
    const {onDeleteRule} = this.props;
    onDeleteRule([ruleId]);
  };

  handleShowEditRuleModal = (ruleId: Rule['id']) => () => {
    this.setState({editRule: ruleId});
  };

  handleCloseEditRuleModal = () => {
    this.setState({editRule: undefined});
  };

  handleSave = (updatedRule: Rule) => {
    const {onUpdateRule} = this.props;
    onUpdateRule(updatedRule);
  };

  render() {
    const {editRule} = this.state;
    const {
      rules,
      sourceSuggestions,
      onUpdateEventId,
      eventId,
      disabled,
      errors,
    } = this.props;

    if (rules.length === 0) {
      return (
        <EmptyMessage
          icon={<IconWarning size="xl" />}
          description={t('You have no data scrubbing rules')}
        />
      );
    }

    return (
      <React.Fragment>
        <RulesList
          rules={rules}
          onDeleteRule={this.handleDeleteRule}
          onShowEditRuleModal={this.handleShowEditRuleModal}
          disabled={disabled}
        />
        {defined(editRule) && (
          <Dialog
            rule={rules[editRule]}
            sourceSuggestions={sourceSuggestions}
            onClose={this.handleCloseEditRuleModal}
            onUpdateEventId={onUpdateEventId}
            onSaveRule={this.handleSave}
            eventId={eventId}
            errors={errors}
          />
        )}
      </React.Fragment>
    );
  }
}

export default Content;
