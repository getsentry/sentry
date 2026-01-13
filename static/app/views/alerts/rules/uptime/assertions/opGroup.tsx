import {useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {type SelectOption} from 'sentry/components/core/compactSelect';
import {CompositeSelect} from 'sentry/components/core/compactSelect/composite';
import {SelectTrigger} from 'sentry/components/core/compactSelect/trigger';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {uniqueId} from 'sentry/utils/guid';
import type {GroupOp, LogicalOp, Op} from 'sentry/views/alerts/rules/uptime/types';

import {AddOpButton} from './addOpButton';
import {AssertionOpHeader} from './opHeader';
import {AssertionOpJsonPath} from './opJsonPath';
import {AssertionOpStatusCode} from './opStatusCode';

interface AssertionOpGroupProps {
  onChange: (op: LogicalOp) => void;
  value: LogicalOp;
  onRemove?: () => void;
  root?: boolean;
}

const GROUP_TYPE_OPTIONS: Array<SelectOption<'and' | 'or'>> = [
  {value: 'and', label: t('Assert All')},
  {value: 'or', label: t('Assert Any')},
];

export function AssertionOpGroup({
  value,
  onChange,
  onRemove,
  root,
}: AssertionOpGroupProps) {
  const isNegated = value.op === 'not';

  const groupOp = isNegated
    ? // Negated ops could technically contain something other than a logic group,
      // the UI right now only lets you structure the logic this way, but it is
      // possible that someone could send something to the API that we can't
      // render, in which case we'll just render this as an empty group
      value.operand.op !== 'and' && value.operand.op !== 'or'
      ? {id: value.id, op: 'and' as const, children: []}
      : value.operand
    : value;

  const [notId] = useState(() => uniqueId());

  const handleAddOp = (newOp: Op) => {
    const newGroupOp: GroupOp = {
      ...groupOp,
      children: [...groupOp.children, newOp],
    };
    onChange(isNegated ? {id: notId, op: 'not', operand: newGroupOp} : newGroupOp);
  };

  const handleUpdateChild = (index: number, updatedOp: Op) => {
    const newChildren = [...groupOp.children];
    newChildren[index] = updatedOp;
    const newGroupOp: GroupOp = {...groupOp, children: newChildren};
    onChange(isNegated ? {id: notId, op: 'not', operand: newGroupOp} : newGroupOp);
  };

  const handleRemoveChild = (index: number) => {
    const newChildren = groupOp.children.filter((_, i) => i !== index);
    const newGroupOp: GroupOp = {...groupOp, children: newChildren};
    onChange(isNegated ? {id: notId, op: 'not', operand: newGroupOp} : newGroupOp);
  };

  const handleGroupTypeChange = (newType: 'and' | 'or') => {
    const newGroupOp: GroupOp = {
      ...groupOp,
      op: newType,
    };
    onChange(isNegated ? {id: notId, op: 'not', operand: newGroupOp} : newGroupOp);
  };

  const handleNegationToggle = (negated: boolean) => {
    onChange(negated ? {id: notId, op: 'not', operand: groupOp} : groupOp);
  };

  // Generate label based on negation and group type
  const triggerLabel = isNegated
    ? groupOp.op === 'and'
      ? t('Assert None')
      : t('Assert Not Any')
    : groupOp.op === 'and'
      ? t('Assert All')
      : t('Assert Any');

  const renderOp = (op: Op, index: number) => {
    switch (op.op) {
      case 'status_code_check':
        return (
          <AssertionOpStatusCode
            key={op.id}
            value={op}
            onChange={updatedOp => handleUpdateChild(index, updatedOp)}
            onRemove={() => handleRemoveChild(index)}
          />
        );
      case 'json_path':
        return (
          <AssertionOpJsonPath
            key={op.id}
            value={op}
            onChange={updatedOp => handleUpdateChild(index, updatedOp)}
            onRemove={() => handleRemoveChild(index)}
          />
        );
      case 'header_check':
        return (
          <AssertionOpHeader
            key={op.id}
            value={op}
            onChange={updatedOp => handleUpdateChild(index, updatedOp)}
            onRemove={() => handleRemoveChild(index)}
          />
        );
      case 'and':
      case 'or':
      case 'not':
        return (
          <AssertionOpGroup
            key={op.id}
            value={op}
            onChange={updatedOp => handleUpdateChild(index, updatedOp)}
            onRemove={() => handleRemoveChild(index)}
          />
        );
      default:
        return null;
    }
  };

  if (root) {
    return (
      <Stack gap="md">
        {groupOp.children.map((child, index) => renderOp(child, index))}
        <div>
          <AddOpButton
            triggerProps={{icon: <IconAdd />}}
            triggerLabel={t('Add Assertion')}
            onAddOp={handleAddOp}
          />
        </div>
      </Stack>
    );
  }

  return (
    <GroupContainer role="group">
      <GroupHeading>
        <CompositeSelect
          size="xs"
          trigger={props => (
            <SelectTrigger.Button {...props} size="zero" borderless>
              {triggerLabel}
            </SelectTrigger.Button>
          )}
        >
          <CompositeSelect.Region
            value={groupOp.op}
            onChange={option => handleGroupTypeChange(option.value)}
            options={GROUP_TYPE_OPTIONS}
          />
          <CompositeSelect.Region
            multiple
            value={isNegated ? ['negated'] : []}
            onChange={options =>
              handleNegationToggle(options.some(o => o.value === 'negated'))
            }
            options={[{value: 'negated', label: t('Negate result')}]}
          />
        </CompositeSelect>
        <AddOpButton
          size="xs"
          triggerProps={{
            borderless: true,
            size: 'zero',
            icon: <IconAdd size="xs" />,
            title: t('Add assertion to group'),
            'aria-label': t('Add assertion to group'),
          }}
          onAddOp={handleAddOp}
        />
        <TopBorder rightBorder={!onRemove} />
        {onRemove && (
          <Button
            size="sm"
            borderless
            icon={<IconDelete />}
            aria-label={t('Remove Group')}
            onClick={onRemove}
          />
        )}
      </GroupHeading>
      <Stack gap="md">
        {groupOp.children.length === 0 && (
          <Text size="xs">{t('Empty assertion group')}</Text>
        )}
        {groupOp.children.map((child, index) => renderOp(child, index))}
      </Stack>
    </GroupContainer>
  );
}

const GroupContainer = styled('div')`
  --margin-right-align: calc(${p => p.theme.space.xl} + 2px);
  --container-padding: ${p => p.theme.space.lg};
  --border-radius: ${p => p.theme.radius.md};
  --border-color: ${p => p.theme.tokens.border.primary};

  position: relative;
  padding: var(--container-padding);
  padding-top: 0;
  margin-right: var(--margin-right-align);

  > :last-child {
    position: relative;
  }

  > :last-child::before {
    content: '';
    position: absolute;
    inset: calc(var(--container-padding) * -1);
    top: 0;
    border: 1px dashed var(--border-color);
    border-top: none;
    border-radius: var(--border-radius);
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    pointer-events: none;
  }
`;

const TopBorder = styled('div')<{rightBorder?: boolean}>`
  flex-grow: 1;
  align-self: stretch;
  display: flex;
  flex-direction: column;

  &:before {
    content: '';
    flex-grow: 1;
  }

  &:after {
    content: '';
    flex-grow: 1;
    display: block;
    border-top: 1px dashed var(--border-color);
    ${p =>
      p.rightBorder &&
      css`
        border-right: 1px dashed var(--border-color);
        border-top-right-radius: var(--border-radius);
        margin-right: var(--margin-right-align);
      `};
  }
`;

const GroupHeading = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space['2xs']};
  margin-left: calc((var(--container-padding) + ${p => p.theme.space.sm}) * -1);
  margin-right: calc((var(--container-padding) + var(--margin-right-align)) * -1);
  margin-top: calc(${p => p.theme.space.md} * -1);
`;
