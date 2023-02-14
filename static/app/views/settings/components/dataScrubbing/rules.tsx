import {forwardRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ConfirmDelete from 'sentry/components/confirmDelete';
import TextOverflow from 'sentry/components/textOverflow';
import {IconDelete, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {Rule} from './types';
import {getRuleDescription} from './utils';

type Props = {
  rules: Array<Rule>;
  disabled?: boolean;
  onDeleteRule?: (id: Rule['id']) => void;
  onEditRule?: (id: Rule['id']) => void;
};

const Rules = forwardRef(function RulesList(
  {rules, onEditRule, onDeleteRule, disabled}: Props,
  ref: React.Ref<HTMLUListElement>
) {
  return (
    <List ref={ref} isDisabled={disabled} data-test-id="advanced-data-scrubbing-rules">
      {rules.map(rule => {
        const {id} = rule;
        const ruleDescription = getRuleDescription(rule);
        return (
          <ListItem key={id}>
            <TextOverflow>{ruleDescription}</TextOverflow>
            {onEditRule && (
              <Button
                aria-label={t('Edit Rule')}
                size="sm"
                onClick={() => onEditRule(id)}
                icon={<IconEdit />}
                disabled={disabled}
                title={
                  disabled ? t('You do not have permission to edit rules') : undefined
                }
              />
            )}
            {onDeleteRule && (
              <ConfirmDelete
                message={t('Are you sure you wish to delete this rule?')}
                priority="danger"
                onConfirm={() => onDeleteRule(id)}
                confirmInput={ruleDescription}
                disabled={disabled}
                stopPropagation
              >
                <Button
                  aria-label={t('Delete Rule')}
                  size="sm"
                  icon={<IconDelete />}
                  disabled={disabled}
                  title={
                    disabled ? t('You do not have permission to delete rules') : undefined
                  }
                />
              </ConfirmDelete>
            )}
          </ListItem>
        );
      })}
    </List>
  );
});

export default Rules;

const List = styled('ul')<{
  isDisabled?: boolean;
}>`
  list-style: none;
  margin: 0;
  padding: 0;
  margin-bottom: 0 !important;
  ${p =>
    p.isDisabled &&
    `
      color: ${p.theme.gray200};
      background: ${p.theme.backgroundSecondary};
  `}
`;

const ListItem = styled('li')`
  display: grid;
  grid-template-columns: auto max-content max-content;
  grid-column-gap: ${space(1)};
  align-items: center;
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
  &:last-child {
    border-bottom: 0;
  }
`;
