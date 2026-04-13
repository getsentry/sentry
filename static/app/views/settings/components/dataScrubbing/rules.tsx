import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {ConfirmDelete} from 'sentry/components/confirmDelete';
import {TextOverflow} from 'sentry/components/textOverflow';
import {IconDelete, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';

import type {Rule} from './types';
import {getRuleDescription} from './utils';

type Props = {
  rules: Rule[];
  disabled?: boolean;
  onDeleteRule?: (id: Rule['id']) => void;
  onEditRule?: (id: Rule['id']) => void;
  ref?: React.Ref<HTMLUListElement>;
};

export function Rules({ref, rules, onEditRule, onDeleteRule, disabled}: Props) {
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
                tooltipProps={{
                  title: disabled
                    ? t('You do not have permission to edit rules')
                    : undefined,
                }}
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
                  tooltipProps={{
                    title: disabled
                      ? t('You do not have permission to delete rules')
                      : undefined,
                  }}
                />
              </ConfirmDelete>
            )}
          </ListItem>
        );
      })}
    </List>
  );
}

const List = styled('ul')<{
  isDisabled?: boolean;
}>`
  list-style: none;
  margin: 0;
  padding: 0;
  margin-bottom: 0 !important;
  ${p =>
    p.isDisabled &&
    css`
      color: ${p.theme.tokens.content.disabled};
      background: ${p.theme.tokens.background.secondary};
    `}
`;

const ListItem = styled('li')`
  display: grid;
  grid-template-columns: auto max-content max-content;
  grid-column-gap: ${p => p.theme.space.md};
  align-items: center;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  &:last-child {
    border-bottom: 0;
  }
`;
