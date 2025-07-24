import {useContext} from 'react';
import styled from '@emotion/styled';
import toNumber from 'lodash/toNumber';

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
  DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {MetricDetectorFormData} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {getMetricDetectorSuffix} from 'sentry/views/detectors/utils/metricDetectorSuffix';

const priorities = [
  DetectorPriorityLevel.LOW,
  DetectorPriorityLevel.MEDIUM,
  DetectorPriorityLevel.HIGH,
] as const;

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

function ThresholdPriority({thresholdSuffix}: {thresholdSuffix: string}) {
  const conditionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionType
  );
  const conditionValue = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionValue
  );

  return (
    <div>
      {conditionKindAndTypeToLabel.static[conditionType!]}{' '}
      {conditionValue === '' ? '0' : conditionValue}
      {thresholdSuffix}
    </div>
  );
}

function ChangePriority({thresholdSuffix}: {thresholdSuffix: string}) {
  const conditionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionType
  );
  const conditionValue = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionValue
  );

  return (
    <div>
      {conditionValue === '' ? '0' : conditionValue}
      {thresholdSuffix} {conditionKindAndTypeToLabel.percent[conditionType!]}
    </div>
  );
}

function createValidationError(field: string, message: string): [string, string] {
  return [field, message];
}

function validateThresholdOrder(
  value: number,
  reference: number,
  conditionType: DataConditionType,
  isGreaterExpected: boolean
): boolean {
  if (conditionType === DataConditionType.GREATER) {
    return isGreaterExpected ? value > reference : value < reference;
  }
  // For LESS condition type, logic is inverted
  return isGreaterExpected ? value < reference : value > reference;
}

function validateHighThreshold({
  form,
}: {
  form: MetricDetectorFormData;
  id: string;
}): Array<[string, string]> {
  const highNum = toNumber(form.highThreshold);
  const conditionNum = toNumber(form.conditionValue);
  const {conditionType} = form;

  if (!conditionType) {
    return [];
  }

  if (highNum !== null && conditionNum !== null) {
    if (!validateThresholdOrder(highNum, conditionNum, conditionType, true)) {
      const message = t(
        'High threshold must be %s than medium threshold',
        conditionType === DataConditionType.GREATER ? t('higher') : t('lower')
      );
      return [createValidationError(METRIC_DETECTOR_FORM_FIELDS.highThreshold, message)];
    }
  }

  return [];
}

interface PriorityControlProps {
  minimumPriority: DetectorPriorityLevel.MEDIUM | DetectorPriorityLevel.HIGH;
}

export default function PriorityControl({minimumPriority}: PriorityControlProps) {
  const detectionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.detectionType
  );
  const initialPriorityLevel = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.initialPriorityLevel
  );
  const conditionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionType
  );
  const aggregate = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.aggregateFunction
  );
  const thresholdSuffix = getMetricDetectorSuffix(detectionType, aggregate);

  if (detectionType === 'dynamic') {
    return null;
  }

  return (
    <Grid>
      <PrioritizeRow
        left={
          <Flex align="center" direction="column">
            {detectionType === 'static' ? (
              <ThresholdPriority thresholdSuffix={thresholdSuffix} />
            ) : (
              <ChangePriority thresholdSuffix={thresholdSuffix} />
            )}
            <SecondaryLabel>({t('issue created')})</SecondaryLabel>
          </Flex>
        }
        right={<InitialPrioritySelect minimumPriority={minimumPriority} />}
      />
      {initialPriorityLevel === DetectorPriorityLevel.MEDIUM && (
        <PrioritizeRow
          left={
            <Flex align="center" gap="md">
              <SmallNumberField
                inline={false}
                hideLabel
                flexibleControlStateSize
                size="sm"
                suffix={thresholdSuffix}
                placeholder="0"
                name={METRIC_DETECTOR_FORM_FIELDS.highThreshold}
                aria-label={t('High threshold')}
                validate={validateHighThreshold}
                required
              />
              <div>{conditionKindAndTypeToLabel[detectionType][conditionType!]}</div>
            </Flex>
          }
          right={<GroupPriorityBadge showLabel priority={PriorityLevel.HIGH} />}
        />
      )}
    </Grid>
  );
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
  width: 6rem;
  padding: 0;
  & > div {
    padding-left: 0;
  }
`;

const SecondaryLabel = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;
