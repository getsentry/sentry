import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {GroupPriorityBadge} from 'sentry/components/badge/groupPriority';
import {Chevron} from 'sentry/components/chevron';
import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import {Flex} from 'sentry/components/container/flex';
import {FieldWrapper} from 'sentry/components/forms/fieldGroup/fieldWrapper';
import NumberField from 'sentry/components/forms/fields/numberField';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PriorityLevel} from 'sentry/types/group';

export interface PriorityControlGridProps {
  name: string;
  onPriorityChange?: (value: PriorityLevel) => void;
  onThresholdChange?: (level: PriorityLevel, threshold: number) => void;
  priority?: PriorityLevel;
  thresholds?: PriorityThresholds;
}

export interface PriorityThresholds {
  high?: number;
  medium?: number;
}

export default function PriorityControl({
  name,
  priority: initialPriority,
  onPriorityChange,
  thresholds: initialThresholds,
  onThresholdChange,
}: PriorityControlGridProps) {
  const [priority, setPriority] = useState<PriorityLevel>(
    initialPriority ?? PriorityLevel.LOW
  );
  const [thresholds, setThresholds] = useState<PriorityThresholds>(
    initialThresholds ?? {}
  );
  const setCreatedPriority = useCallback(
    (level: PriorityLevel) => {
      setPriority(level);
      onPriorityChange?.(level);
    },
    [setPriority, onPriorityChange]
  );
  const setMediumThreshold = useCallback(
    (threshold: number) => {
      setThresholds(v => ({...v, [PriorityLevel.MEDIUM]: threshold}));
      onThresholdChange?.(PriorityLevel.MEDIUM, threshold);
    },
    [setThresholds, onThresholdChange]
  );
  const setHighThreshold = useCallback(
    (threshold: number) => {
      setThresholds(v => ({...v, [PriorityLevel.HIGH]: threshold}));
      onThresholdChange?.(PriorityLevel.HIGH, threshold);
    },
    [setThresholds, onThresholdChange]
  );

  return (
    <Grid>
      <PrioritizeRow
        left={<span style={{textAlign: 'right'}}>{t('Issue created')}</span>}
        right={<PrioritySelect value={priority} onChange={setCreatedPriority} />}
      />
      {priorityIsConfigurable(priority, PriorityLevel.MEDIUM) && (
        <PrioritizeRow
          left={
            <NumberField
              alignRight
              inline
              hideLabel
              flexibleControlStateSize
              size="sm"
              suffix="s"
              // empty string required to keep this as a controlled input
              value={thresholds[PriorityLevel.MEDIUM] ?? ''}
              onChange={threshold => setMediumThreshold(Number(threshold))}
              name={`${name}-medium`}
              data-test-id="priority-control-medium"
            />
          }
          right={
            <GroupPriorityBadge
              showLabel
              variant="signal"
              priority={PriorityLevel.MEDIUM}
            />
          }
        />
      )}
      {priorityIsConfigurable(priority, PriorityLevel.HIGH) && (
        <PrioritizeRow
          left={
            <NumberField
              alignRight
              inline
              hideLabel
              flexibleControlStateSize
              size="sm"
              suffix="s"
              // empty string required to keep this as a controlled input
              value={thresholds[PriorityLevel.HIGH] ?? ''}
              onChange={threshold => setHighThreshold(Number(threshold))}
              name={`${name}-high`}
              data-test-id="priority-control-high"
            />
          }
          right={
            <GroupPriorityBadge
              showLabel
              variant="signal"
              priority={PriorityLevel.HIGH}
            />
          }
        />
      )}
    </Grid>
  );
}

function priorityIsConfigurable(
  createdPriority: PriorityLevel,
  targetPriority: PriorityLevel
): boolean {
  if (createdPriority === PriorityLevel.LOW) {
    return (
      targetPriority === PriorityLevel.MEDIUM || targetPriority === PriorityLevel.HIGH
    );
  }
  if (createdPriority === PriorityLevel.MEDIUM) {
    return targetPriority === PriorityLevel.HIGH;
  }
  return false;
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

const priorities = [PriorityLevel.LOW, PriorityLevel.MEDIUM, PriorityLevel.HIGH];

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
        textValue: priority,
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
