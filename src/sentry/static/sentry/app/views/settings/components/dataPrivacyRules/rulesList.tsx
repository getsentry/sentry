import React from 'react';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import space from 'app/styles/space';
import TextOverflow from 'app/components/textOverflow';
import {IconDelete, IconEdit} from 'app/icons';
import Button from 'app/components/button';

import DataPrivacyRulesForm from './dataPrivacyRulesForm/dataPrivacyRulesForm';
import {getRuleTypeLabel, getMethodTypeLabel} from './dataPrivacyRulesForm/utils';

type Rule = React.ComponentProps<typeof DataPrivacyRulesForm>['rule'];
type Props = {
  rules: Array<Rule>;
  onShowEditRuleModal?: (id: Rule['id']) => () => void;
  onDeleteRule?: (id: Rule['id']) => () => void;
  disabled?: boolean;
};

const RulesList = React.forwardRef<HTMLUListElement, Props>(function RulesList(
  {rules, onShowEditRuleModal, onDeleteRule, disabled},
  ref
) {
  return (
    <List ref={ref} isDisabled={disabled}>
      {rules.map(({id, method, type, source}) => {
        const methodLabel = getMethodTypeLabel(method);
        const typelabel = getRuleTypeLabel(type);
        return (
          <ListItem key={id}>
            <TextOverflow>
              {`[${methodLabel.label}] [${typelabel}] ${t('from')} [${source}]`}
            </TextOverflow>
            {onShowEditRuleModal && (
              <Button
                label={t('Edit Rule')}
                size="small"
                onClick={onShowEditRuleModal(id)}
                icon={<IconEdit />}
                disabled={disabled}
              />
            )}
            {onDeleteRule && (
              <Button
                label={t('Delete Rule')}
                size="small"
                onClick={onDeleteRule(id)}
                icon={<IconDelete />}
                disabled={disabled}
              />
            )}
          </ListItem>
        );
      })}
    </List>
  );
});

RulesList.propTypes = {
  rules: PropTypes.array.isRequired,
  onShowEditRuleModal: PropTypes.func,
  onDeleteRule: PropTypes.func,
  disabled: PropTypes.bool,
};

export default RulesList;

const List = styled('ul')<{isDisabled?: boolean}>`
  list-style: none;
  margin: 0;
  padding: 0;
  margin-bottom: 0 !important;
  ${p =>
    p.isDisabled &&
    `
      color: ${p.theme.gray1};
      background: ${p.theme.offWhite};
  `}
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
