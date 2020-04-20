import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import {defined} from 'app/utils';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import {IconDelete, IconWarning} from 'app/icons';

import DataPrivacyRulesPanelRuleModal from './dataPrivacyRulesPanelRuleModal';
import {getRuleTypeSelectorFieldLabel, getMethodTypeSelectorFieldLabel} from './utils';

type DataPrivacyRulesPanelRuleModalProps = React.ComponentProps<
  typeof DataPrivacyRulesPanelRuleModal
>;

type Rule = NonNullable<DataPrivacyRulesPanelRuleModalProps['rule']>;

type Props = {
  rules: Array<Rule>;
  onUpdateRule: (updatedRule: Rule) => void;
  onDeleteRule: (rulesToBeDeleted: Array<Rule['id']>) => void;
} & Pick<
  DataPrivacyRulesPanelRuleModalProps,
  'disabled' | 'eventId' | 'onUpdateEventId' | 'selectorSuggestions'
>;

type State = {
  selectedRules: Array<Rule['id']>;
  editRule?: Rule['id'];
};

class DataPrivacyRulesPanelContent extends React.Component<Props, State> {
  state: State = {
    selectedRules: [],
  };

  handleSelectRule = (ruleId: number, isChecked: boolean) => (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    event.stopPropagation();

    const {selectedRules} = this.state;

    if (isChecked) {
      this.setState({
        selectedRules: selectedRules.filter(selectedRule => selectedRule !== ruleId),
      });
      return;
    }

    this.setState({
      selectedRules: [...selectedRules, ruleId],
    });
  };

  handleDeleteRule = (ruleId: Rule['id']) => (
    event?: React.MouseEvent<SVGAElement | SVGElement>
  ) => {
    event?.stopPropagation();

    const {onDeleteRule} = this.props;

    onDeleteRule([ruleId]);
  };

  handleSelectAll = (selectAll: boolean) => {
    if (selectAll) {
      const {rules} = this.props;

      this.setState({
        selectedRules: rules.map(rule => rule.id),
      });
      return;
    }

    this.setState({
      selectedRules: [],
    });
  };

  handleDeleteAllSelected = (event: React.MouseEvent<SVGAElement>) => {
    event.stopPropagation();

    const {onDeleteRule} = this.props;
    const {selectedRules} = this.state;

    this.setState(
      {
        selectedRules: [],
      },
      () => {
        onDeleteRule(selectedRules);
      }
    );
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

  handleSave = (updatedRule: Rule) => {
    const {onUpdateRule} = this.props;

    this.setState(
      {
        editRule: undefined,
      },
      () => {
        onUpdateRule(updatedRule);
      }
    );
  };

  render() {
    const {selectedRules, editRule} = this.state;
    const {rules, selectorSuggestions, onUpdateEventId, eventId} = this.props;

    if (rules.length === 0) {
      return (
        <EmptyMessage
          icon={<IconWarning size="xl" />}
          description={t('You have no data privacy rules')}
        />
      );
    }

    return (
      <React.Fragment>
        <List>
          {rules.map(({id, method, type, from}) => {
            const isChecked = selectedRules.includes(id);
            const methodLabel = getMethodTypeSelectorFieldLabel(method);
            const typelabel = getRuleTypeSelectorFieldLabel(type);
            return (
              <ListItem
                key={id}
                isChecked={isChecked}
                onClick={this.handleShowEditRuleModal(id)}
              >
                <span>{`[${methodLabel}] [${typelabel}] ${t('from')} [${from}]`}</span>
                <StyledIconDelete onClick={this.handleDeleteRule(id)} />
              </ListItem>
            );
          })}
        </List>
        {defined(editRule) && (
          <DataPrivacyRulesPanelRuleModal
            rule={rules[editRule]}
            selectorSuggestions={selectorSuggestions}
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

export default DataPrivacyRulesPanelContent;

const List = styled('ul')`
  list-style: none;
  margin: 0;
  padding: 0;
  margin-bottom: 0 !important;
`;

const StyledIconDelete = styled(IconDelete)`
  opacity: 0.3;
`;

const ListItem = styled('li')<{isChecked?: boolean}>`
  display: grid;
  grid-template-columns: auto max-content;
  grid-column-gap: ${space(1)};
  align-items: center;
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.borderDark};
  cursor: pointer;
  &:hover {
    ${StyledIconDelete} {
      opacity: 1;
    }
    background-color: ${p => p.theme.offWhite};
    span {
      color: ${p => p.theme.blue};
      text-decoration: underline;
    }
  }

  &:last-child {
    border-bottom: 0;
  }
`;
