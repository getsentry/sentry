import React from 'react';

import {t} from 'app/locale';
import {defined} from 'app/utils';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import {IconWarning} from 'app/icons';

import RulesList from './rulesList';
import Dialog from './dialog';

type DialogProps = React.ComponentProps<typeof Dialog>;
type Rule = NonNullable<DialogProps['rule']>;

type Props = {
  rules: Array<Rule>;
  onUpdateRule: DialogProps['onSaveRule'];
  onDeleteRule: (rulesToBeDeleted: Array<Rule['id']>) => void;
  disabled?: boolean;
} & Pick<DialogProps, 'eventId' | 'onUpdateEventId' | 'sourceSuggestions'>;

type State = {
  editRule?: Rule['id'];
};

class Content extends React.Component<Props, State> {
  state: State = {
    editRule: undefined,
  };

  handleDeleteRule = (ruleId: Rule['id']) => () => {
    const {onDeleteRule} = this.props;
    onDeleteRule([ruleId]);
  };

  handleShowEditRuleModal = (ruleId: Rule['id']) => () => {
    this.setState({
      editRule: ruleId,
    });
  };

  handleCloseEditRuleModal = () => {
    this.setState({
      editRule: undefined,
    });
  };

  handleSave = async (updatedRule: Rule) => {
    const {onUpdateRule} = this.props;

    return await onUpdateRule(updatedRule).then(result => {
      if (!result) {
        this.setState({
          editRule: undefined,
        });
        return undefined;
      }
      return result;
    });
  };

  render() {
    const {editRule} = this.state;
    const {rules, sourceSuggestions, onUpdateEventId, eventId, disabled} = this.props;

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
          />
        )}
      </React.Fragment>
    );
  }
}

export default Content;
