import {useContext} from 'react';
import styled from '@emotion/styled';

import {GroupPriorityBadge} from 'sentry/components/badge/groupPriority';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Flex} from 'sentry/components/core/layout';
import NumberField from 'sentry/components/forms/fields/numberField';
import FormContext from 'sentry/components/forms/formContext';
import {IconArrow, IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PriorityLevel} from 'sentry/types/group';
import {
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import {
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metricFormData';
import {useDetectorThresholdSuffix} from 'sentry/views/detectors/components/forms/useDetectorThresholdSuffix';

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

const conditionKindAndTypeToLabel: Record<
  'static' | 'percent',
  Record<DataConditionType.GREATER | DataConditionType.LESS, string>
> = {
  static: {
    [DataConditionType.GREATER]: t('Above'),
    [DataConditionType.LESS]: t('Below'),
  },
  percent: {
    [DataConditionType.GREATER]: t('higher'),
    [DataConditionType.LESS]: t('lower'),
  },
};

function ThresholdPriority() {
  const conditionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionType
  );
  const conditionValue = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionValue
  );
  const thresholdSuffix = useDetectorThresholdSuffix();
  return (
    <div>
      {conditionKindAndTypeToLabel.static[conditionType!]}{' '}
      {conditionValue === '' ? '0' : conditionValue}
      {thresholdSuffix}
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
  const thresholdSuffix = useDetectorThresholdSuffix();
  return (
    <div>
      {conditionValue === '' ? '0' : conditionValue}
      {thresholdSuffix} {conditionKindAndTypeToLabel.percent[conditionType!]}
    </div>
  );
}

interface PriorityControlProps {
  minimumPriority: DetectorPriorityLevel;
}

export default function PriorityControl({minimumPriority}: PriorityControlProps) {
  const detectorKind = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.kind);
  const initialPriorityLevel = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.initialPriorityLevel
  );
  const thresholdSuffix = useDetectorThresholdSuffix();
  const conditionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionType
  );

  if (detectorKind === 'dynamic') {
    return null;
  }

  return (
    <Grid>
      <PrioritizeRow
        left={
          <Flex align="center" direction="column">
            {!detectorKind || detectorKind === 'static' ? (
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
            <Flex align="center" gap={space(1)}>
              <SmallNumberField
                alignRight
                inline
                hideLabel
                flexibleControlStateSize
                size="sm"
                suffix={thresholdSuffix}
                placeholder="0"
                name={METRIC_DETECTOR_FORM_FIELDS.mediumThreshold}
                aria-label={t('Medium threshold')}
              />
              <div>{conditionKindAndTypeToLabel[detectorKind][conditionType!]}</div>
            </Flex>
          }
          right={<GroupPriorityBadge showLabel priority={PriorityLevel.MEDIUM} />}
        />
      )}
      {priorityIsConfigurable(initialPriorityLevel, DetectorPriorityLevel.HIGH) && (
        <PrioritizeRow
          left={
            <Flex align="center" gap={space(1)}>
              <SmallNumberField
                alignRight
                inline
                hideLabel
                flexibleControlStateSize
                size="sm"
                suffix={thresholdSuffix}
                placeholder="0"
                name={METRIC_DETECTOR_FORM_FIELDS.highThreshold}
                aria-label={t('High threshold')}
              />
              <div>{conditionKindAndTypeToLabel[detectorKind][conditionType!]}</div>
            </Flex>
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
      <Cell>{left}</Cell>
      <IconArrow color="gray300" direction="right" />
      <Flex align="center">{right}</Flex>
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

const Cell = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: ${space(1)};
`;

const SmallNumberField = styled(NumberField)`
  width: 3.5rem;
  padding: 0;
  & > div {
    padding-left: 0;
  }
`;

const SecondaryLabel = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;
