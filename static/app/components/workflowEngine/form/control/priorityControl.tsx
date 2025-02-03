import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {GroupPriorityBadge} from 'sentry/components/badge/groupPriority';
import {Chevron} from 'sentry/components/chevron';
import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import {Flex} from 'sentry/components/container/flex';
import FieldWrapper from 'sentry/components/forms/fieldGroup/fieldWrapper';
import NumberField from 'sentry/components/forms/fields/numberField';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PriorityLevel} from 'sentry/types/group';

export interface PriorityControlGridProps {
  name: string;
  /** Number of rows to display (defaults to 3) */
  limit?: number;
}

function getPriority(item: number, limit: number): PriorityLevel {
  if (item === limit - 1) {
    return PriorityLevel.HIGH;
  }
  if (limit === 3 && item === 0) {
    return PriorityLevel.LOW;
  }
  return PriorityLevel.MEDIUM;
}

/**
 * TODO(nate): expose as controlled component that accepts onChange
 */
export default function PriorityControl({
  name,
  limit: _limit = 3,
}: PriorityControlGridProps) {
  const limit = Math.max(1, Math.min(_limit, 3));

  const [defaultPriority, setDefaultPriority] = useState(getPriority(0, limit));
  const [secondaryThreshold, setSecondaryThreshold] = useState(0);
  const [tertiaryThreshold, setTertiaryThreshold] = useState(0);

  return (
    <Grid>
      {[
        <PrioritizeRow
          key="priority-main"
          left={<span style={{textAlign: 'right'}}>{t('Issue created')}</span>}
          right={<PrioritySelect value={defaultPriority} onChange={setDefaultPriority} />}
        />,
        <PrioritizeRow
          key="priority-secondary"
          left={
            <NumberField
              placeholder={0}
              alignRight
              inline
              hideLabel
              flexibleControlStateSize
              size="sm"
              suffix="s"
              value={secondaryThreshold}
              onChange={threshold => setSecondaryThreshold(threshold)}
              name={`${name}-secondary`}
            />
          }
          right={
            <GroupPriorityBadge
              showLabel
              variant="signal"
              priority={getPriority(1, limit)}
            />
          }
        />,
        <PrioritizeRow
          key="priority-tertiary"
          left={
            <NumberField
              placeholder={0}
              alignRight
              inline
              hideLabel
              flexibleControlStateSize
              size="sm"
              suffix="s"
              value={tertiaryThreshold}
              onChange={threshold => setTertiaryThreshold(threshold)}
              name={`${name}-tertiary`}
            />
          }
          right={
            <GroupPriorityBadge
              showLabel
              variant="signal"
              priority={getPriority(2, limit)}
            />
          }
        />,
      ].slice(0, limit)}
    </Grid>
  );
}

function PrioritizeRow({left, right}: {left: React.ReactNode; right: React.ReactNode}) {
  return (
    <Row>
      <Cell align="center" justify="flex-end">
        {left}
      </Cell>
      <IconArrow color="gray300" direction="right" />
      <Cell align="center" justify="flex-start">
        {right}
      </Cell>
    </Row>
  );
}

const priorities = [PriorityLevel.HIGH, PriorityLevel.MEDIUM, PriorityLevel.LOW];

function PrioritySelect({
  value: initialValue,
  onChange = () => {},
}: {
  onChange?: (value: PriorityLevel) => void;
  value?: PriorityLevel;
}) {
  const [value, setValue] = useState<PriorityLevel>(initialValue ?? PriorityLevel.HIGH);
  const handleChange = useCallback(
    (select: SelectOption<PriorityLevel>) => {
      onChange(select.value);
      setValue(select.value);
    },
    [onChange, setValue]
  );

  return (
    <CompactSelect
      size="xs"
      trigger={(props, isOpen) => {
        return (
          <EmptyButton {...props}>
            <GroupPriorityBadge showLabel variant="signal" priority={value}>
              <InteractionStateLayer isPressed={isOpen} />
              <Chevron light direction={isOpen ? 'up' : 'down'} size="small" />
            </GroupPriorityBadge>
          </EmptyButton>
        );
      }}
      options={priorities.map(priority => ({
        label: <GroupPriorityBadge showLabel variant="signal" priority={priority} />,
        value: priority,
      }))}
      value={value}
      onChange={handleChange}
    />
  );
}

const EmptyButton = styled('button')`
  appearance: none;
  padding: ${space(1)};
  margin: -${space(1)};
  font: inherit;
  border: none;
  background: transparent;
`;

const Grid = styled('div')`
  display: grid;
  grid-template-columns: minmax(0, auto) 1em minmax(0, 1fr);
  align-items: center;
  max-width: max-content;
  gap: 0 ${space(1)};
`;

const Row = styled('div')`
  display: contents;
`;

const Cell = styled(Flex)`
  padding: ${space(1)};

  ${FieldWrapper} {
    padding: 0;
    width: 5rem;
  }
`;
