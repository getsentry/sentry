import {forwardRef} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import TextOverflow from 'sentry/components/textOverflow';
import {IconDelete, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

import {MethodType, Rule, RuleType} from './types';
import {getMethodLabel, getRuleLabel} from './utils';

type Props = {
  rules: Array<Rule>;
  disabled?: boolean;
  onDeleteRule?: (id: Rule['id']) => () => void;
  onEditRule?: (id: Rule['id']) => () => void;
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

const Rules = forwardRef(function RulesList(
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
                aria-label={t('Edit Rule')}
                size="sm"
                onClick={onEditRule(id)}
                icon={<IconEdit />}
                disabled={disabled}
              />
            )}
            {onDeleteRule && (
              <Button
                aria-label={t('Delete Rule')}
                size="sm"
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
