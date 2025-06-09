import {useContext} from 'react';
import styled from '@emotion/styled';

import {GroupPriorityBadge} from 'sentry/components/badge/groupPriority';
import {Flex} from 'sentry/components/container/flex';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {FieldWrapper} from 'sentry/components/forms/fieldGroup/fieldWrapper';
import NumberField from 'sentry/components/forms/fields/numberField';
import FormContext from 'sentry/components/forms/formContext';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {useFormField} from 'sentry/components/workflowEngine/form/hooks';
import {IconArrow, IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PriorityLevel} from 'sentry/types/group';

function ThresholdPriority() {
  const lowThresholdDirection = useFormField<string>('conditionGroup.conditions.0.type')!;
  const lowThreshold = useFormField<string>('conditionGroup.conditions.0.comparison')!;
  return (
    <div>
      {lowThresholdDirection === ''
        ? t('Above')
        : lowThresholdDirection === 'above'
          ? t('Above')
          : t('Below')}{' '}
      {lowThreshold === '' ? '0s' : lowThreshold + 's'}
    </div>
  );
}

function ChangePriority() {
  const lowThresholdDirection = useFormField<string>('conditionGroup.conditions.0.type')!;
  const lowThreshold = useFormField<string>('conditionGroup.conditions.0.comparison')!;
  return (
    <div>
      {lowThreshold === '' ? '0' : lowThreshold}%{' '}
      {lowThresholdDirection === ''
        ? t('higher')
        : lowThresholdDirection === 'higher'
          ? t('higher')
          : t('lower')}
    </div>
  );
}

export default function PriorityControl() {
  // TODO: kind type not yet available from detector types
  const detectorKind = useFormField<string>('kind')!;
  const conditionResult =
    useFormField<PriorityLevel>('conditionGroup.conditions.0.conditionResult') ||
    PriorityLevel.LOW;

  return (
    <Grid>
      <PrioritizeRow
        left={
          <Flex align="center" column>
            {!detectorKind || detectorKind === 'threshold' ? (
              <ThresholdPriority />
            ) : (
              <ChangePriority />
            )}
            <SecondaryLabel>({t('issue created')})</SecondaryLabel>
          </Flex>
        }
        right={<PrioritySelect />}
      />
      {priorityIsConfigurable(conditionResult, PriorityLevel.MEDIUM) && (
        <PrioritizeRow
          left={
            <NumberField
              alignRight
              inline
              hideLabel
              flexibleControlStateSize
              size="sm"
              suffix="s"
              placeholder="0"
              name={`conditionGroup.conditions.1.comparison`}
              data-test-id="priority-control-medium"
            />
          }
          right={<GroupPriorityBadge showLabel priority={PriorityLevel.MEDIUM} />}
        />
      )}
      {priorityIsConfigurable(conditionResult, PriorityLevel.HIGH) && (
        <PrioritizeRow
          left={
            <NumberField
              alignRight
              inline
              hideLabel
              flexibleControlStateSize
              size="sm"
              suffix="s"
              placeholder="0"
              name={`conditionGroup.conditions.2.comparison`}
              data-test-id="priority-control-high"
            />
          }
          right={<GroupPriorityBadge showLabel priority={PriorityLevel.HIGH} />}
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

function PrioritySelect() {
  const formContext = useContext(FormContext);
  const conditionResult =
    useFormField<PriorityLevel>('conditionGroup.conditions.0.conditionResult') ||
    PriorityLevel.LOW;

  return (
    <CompactSelect
      size="xs"
      trigger={(props, isOpen) => {
        return (
          <EmptyButton {...props}>
            <GroupPriorityBadge showLabel priority={conditionResult}>
              <InteractionStateLayer isPressed={isOpen} />
              <IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />
            </GroupPriorityBadge>
          </EmptyButton>
        );
      }}
      options={priorities.map(priority => ({
        label: <GroupPriorityBadge showLabel priority={priority} />,
        value: priority,
        textValue: priority,
      }))}
      value={conditionResult}
      onChange={({value}) => {
        formContext.form?.setValue('conditionGroup.conditions.0.conditionResult', value);
      }}
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

const SecondaryLabel = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;
