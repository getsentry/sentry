import {useContext} from 'react';
import styled from '@emotion/styled';

import {GroupPriorityBadge} from 'sentry/components/badge/groupPriority';
import {Flex} from 'sentry/components/container/flex';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {FieldWrapper} from 'sentry/components/forms/fieldGroup/fieldWrapper';
import NumberField from 'sentry/components/forms/fields/numberField';
import FormContext from 'sentry/components/forms/formContext';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconArrow, IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PriorityLevel} from 'sentry/types/group';
import {DetectorPriorityLevel} from 'sentry/types/workflowEngine/dataConditions';
import {
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metricFormData';

const priorities = [
  DetectorPriorityLevel.LOW,
  DetectorPriorityLevel.MEDIUM,
  DetectorPriorityLevel.HIGH,
] as const;

const DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL: Record<
  (typeof priorities)[number],
  PriorityLevel
> = {
  [DetectorPriorityLevel.LOW]: PriorityLevel.LOW,
  [DetectorPriorityLevel.MEDIUM]: PriorityLevel.MEDIUM,
  [DetectorPriorityLevel.HIGH]: PriorityLevel.HIGH,
};

function ThresholdPriority() {
  const conditionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionType
  );
  const conditionValue = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionValue
  );
  return (
    <div>
      {conditionType === 'gt' ? t('Above') : t('Below')}{' '}
      {conditionValue === '' ? '0s' : conditionValue + 's'}
    </div>
  );
}

function ChangePriority() {
  const conditionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionType
  );
  const conditionValue = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionValue
  );
  return (
    <div>
      {conditionValue === '' ? '0' : conditionValue}%{' '}
      {conditionType === 'gt' ? t('higher') : t('lower')}
    </div>
  );
}

interface PriorityControlProps {
  minimumPriority?: DetectorPriorityLevel;
}

export default function PriorityControl({
  minimumPriority = DetectorPriorityLevel.LOW,
}: PriorityControlProps) {
  // TODO: kind type not yet available from detector types
  const detectorKind = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.kind);
  const initialPriorityLevel = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.initialPriorityLevel
  );

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
        right={<InitialPrioritySelect minimumPriority={minimumPriority} />}
      />
      {priorityIsConfigurable(initialPriorityLevel, DetectorPriorityLevel.MEDIUM) && (
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
              name={METRIC_DETECTOR_FORM_FIELDS.mediumThreshold}
              data-test-id="priority-control-medium"
              required
            />
          }
          right={<GroupPriorityBadge showLabel priority={PriorityLevel.MEDIUM} />}
        />
      )}
      {priorityIsConfigurable(initialPriorityLevel, DetectorPriorityLevel.HIGH) && (
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
              name={METRIC_DETECTOR_FORM_FIELDS.highThreshold}
              data-test-id="priority-control-high"
              required
            />
          }
          right={<GroupPriorityBadge showLabel priority={PriorityLevel.HIGH} />}
        />
      )}
    </Grid>
  );
}

function priorityIsConfigurable(
  initialPriorityLevel: DetectorPriorityLevel,
  targetPriority: DetectorPriorityLevel
): boolean {
  return targetPriority > initialPriorityLevel;
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

function InitialPrioritySelect({
  minimumPriority,
}: {
  minimumPriority: DetectorPriorityLevel;
}) {
  const formContext = useContext(FormContext);
  const initialPriorityLevel = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.initialPriorityLevel
  );

  return (
    <CompactSelect
      size="xs"
      trigger={(props, isOpen) => {
        return (
          <EmptyButton type="button" {...props}>
            <GroupPriorityBadge
              showLabel
              priority={DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL[initialPriorityLevel]}
            >
              <InteractionStateLayer isPressed={isOpen} />
              <IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />
            </GroupPriorityBadge>
          </EmptyButton>
        );
      }}
      options={priorities
        .filter(priority => priority >= minimumPriority)
        .map(priority => ({
          label: (
            <GroupPriorityBadge
              showLabel
              priority={DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL[priority]}
            />
          ),
          value: priority,
          textValue: DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL[priority],
        }))}
      value={initialPriorityLevel}
      onChange={({value}) => {
        formContext.form?.setValue(
          METRIC_DETECTOR_FORM_FIELDS.initialPriorityLevel,
          value
        );
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
