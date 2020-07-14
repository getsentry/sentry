import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import TextOverflow from 'app/components/textOverflow';
import {IconDelete, IconEdit} from 'app/icons';
import Button from 'app/components/button';

import {getMethodLabel, getRuleLabel} from './utils';
import {RuleType, MethodType, Rule} from './types';

type Props = {
  rules: Array<Rule>;
  onEditRule?: (id: Rule['id']) => () => void;
  onDeleteRule?: (id: Rule['id']) => () => void;
  disabled?: boolean;
};

const getListItemDescription = (rule: Rule) => {
  const {method, type, source} = rule;
  const methodLabel = getMethodLabel(method);
  const typeLabel = getRuleLabel(type);

  const descriptionDetails: Array<string> = [];

  descriptionDetails.push(`[${methodLabel.label}]`);

  descriptionDetails.push(
    rule.type === RuleType.PATTERN ? `[${rule.pattern}]` : `[${typeLabel}]`
  );

  if (rule.method === MethodType.REPLACE && rule.placeholder) {
    descriptionDetails.push(` with [${rule.placeholder}]`);
  }

  return `${descriptionDetails.join(' ')} ${t('from')} [${source}]`;
};

const Rules = React.forwardRef(function RulesList(
  {rules, onEditRule, onDeleteRule, disabled}: Props,
  ref: React.Ref<HTMLUListElement>
) {
  return (
    <List ref={ref} isDisabled={disabled} data-test-id="advanced-data-scrubbing-rules">
      {rules.map(rule => {
        const {id} = rule;
        return (
          <ListItem key={id}>
            <TextOverflow>{getListItemDescription(rule)}</TextOverflow>
            {onEditRule && (
              <Button
                label={t('Edit Rule')}
                size="small"
                onClick={onEditRule(id)}
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
      color: ${p.theme.gray400};
      background: ${p.theme.gray100};
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
    background-color: ${p => p.theme.gray100};
  }
  &:last-child {
    border-bottom: 0;
  }
`;
