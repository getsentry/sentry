import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import {defined} from 'app/utils';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import {IconDelete, IconWarning, IconEdit} from 'app/icons';
import TextOverflow from 'app/components/textOverflow';
import Button from 'app/components/button';

import DataPrivacyRulesModal from './dataPrivacyRulesModal';
import {getRuleTypeLabel, getMethodTypeLabel} from './dataPrivacyRulesForm/utils';

type ModalProps = React.ComponentProps<typeof DataPrivacyRulesModal>;
type Rule = NonNullable<ModalProps['rule']>;

type Props = {
  rules: Array<Rule>;
  onUpdateRule: ModalProps['onSaveRule'];
  onDeleteRule: (rulesToBeDeleted: Array<Rule['id']>) => void;
} & Pick<ModalProps, 'disabled' | 'eventId' | 'onUpdateEventId' | 'sourceSuggestions'>;

type State = {
  editRule?: Rule['id'];
};

class DataPrivacyRulesContent extends React.Component<Props, State> {
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
    const {rules, sourceSuggestions, onUpdateEventId, eventId} = this.props;

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
          {rules.map(({id, method, type, source}) => {
            const methodLabel = getMethodTypeLabel(method);
            const typelabel = getRuleTypeLabel(type);
            return (
              <ListItem key={id}>
                <TextOverflow>
                  {`[${methodLabel}] [${typelabel}] ${t('from')} [${source}]`}
                </TextOverflow>
                <Button
                  size="small"
                  onClick={this.handleShowEditRuleModal(id)}
                  icon={<IconEdit />}
                />
                <Button
                  size="small"
                  onClick={this.handleDeleteRule(id)}
                  icon={<IconDelete />}
                />
              </ListItem>
            );
          })}
        </List>
        {defined(editRule) && (
          <DataPrivacyRulesModal
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

export default DataPrivacyRulesContent;

const List = styled('ul')`
  list-style: none;
  margin: 0;
  padding: 0;
  margin-bottom: 0 !important;
`;

const ListItem = styled('li')`
  display: grid;
  grid-template-columns: auto max-content max-content;
  grid-column-gap: ${space(1)};
  align-items: center;
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.borderDark};
  &:hover {
    background-color: ${p => p.theme.offWhite};
  }
  &:last-child {
    border-bottom: 0;
  }
`;
