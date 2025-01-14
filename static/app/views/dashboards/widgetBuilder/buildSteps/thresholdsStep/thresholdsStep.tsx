import styled from '@emotion/styled';

import CircleIndicator from 'sentry/components/circleIndicator';
import FieldWrapper from 'sentry/components/forms/fieldGroup/fieldWrapper';
import type {NumberFieldProps} from 'sentry/components/forms/fields/numberField';
import NumberField from 'sentry/components/forms/fields/numberField';
import type {SelectFieldProps} from 'sentry/components/forms/fields/selectField';
import SelectField from 'sentry/components/forms/fields/selectField';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import theme from 'sentry/utils/theme';
import {getThresholdUnitSelectOptions} from 'sentry/views/dashboards/utils';

import {BuildStep} from '../buildStep';

type ThresholdErrors = {
  [K in ThresholdMaxKeys]?: string;
};

type ThresholdsStepProps = {
  errors: ThresholdErrors;
  onThresholdChange: (maxKey: ThresholdMaxKeys, value: string) => void;
  onUnitChange: (unit: string) => void;
  thresholdsConfig: ThresholdsConfig | null;
  dataType?: string;
  dataUnit?: string;
};

type ThresholdRowProp = {
  color: string;
  maxInputProps: NumberFieldProps;
  minInputProps: NumberFieldProps;
  unitOptions: {label: string; value: string}[];
  unitSelectProps: SelectFieldProps<any>;
  maxKey?: ThresholdMaxKeys;
  onThresholdChange?: (maxKey: ThresholdMaxKeys, value: string) => void;
  onUnitChange?: (maxKey: ThresholdMaxKeys, value: string) => void;
};

export enum ThresholdMaxKeys {
  MAX_1 = 'max1',
  MAX_2 = 'max2',
}

type ThresholdMaxValues = {
  [K in ThresholdMaxKeys]?: number;
};

export type ThresholdsConfig = {
  max_values: ThresholdMaxValues;
  unit: string | null;
};

const WIDGET_INDICATOR_SIZE = 15;

function ThresholdRow({
  color,
  minInputProps,
  maxInputProps,
  onThresholdChange,
  onUnitChange,
  maxKey,
  unitOptions,
  unitSelectProps,
}: ThresholdRowProp) {
  const handleChange = (val: string) => {
    if (onThresholdChange && maxKey) {
      onThresholdChange(maxKey, val);
    }
  };

  return (
    <ThresholdRowWrapper>
      <CircleIndicator color={color} size={WIDGET_INDICATOR_SIZE} />
      <StyledNumberField {...minInputProps} inline={false} disabled />
      {t('to')}
      <StyledNumberField onChange={handleChange} {...maxInputProps} inline={false} />
      {unitOptions.length > 0 && (
        <StyledSelectField
          {...unitSelectProps}
          onChange={onUnitChange}
          options={unitOptions}
          inline={false}
        />
      )}
    </ThresholdRowWrapper>
  );
}

export function Thresholds({
  thresholdsConfig,
  onThresholdChange,
  onUnitChange,
  errors,
  dataType = '',
  dataUnit = '',
}: ThresholdsStepProps) {
  const maxOneValue = thresholdsConfig?.max_values[ThresholdMaxKeys.MAX_1] ?? '';
  const maxTwoValue = thresholdsConfig?.max_values[ThresholdMaxKeys.MAX_2] ?? '';
  const unit = thresholdsConfig?.unit ?? dataUnit;
  const unitOptions = ['duration', 'rate'].includes(dataType)
    ? getThresholdUnitSelectOptions(dataType)
    : [];
  const thresholdRowProps: ThresholdRowProp[] = [
    {
      maxKey: ThresholdMaxKeys.MAX_1,
      minInputProps: {
        name: 'firstMinimum',
        value: 0,
        'aria-label': 'First Minimum',
      },
      maxInputProps: {
        name: 'firstMaximum',
        value: maxOneValue,
        'aria-label': 'First Maximum',
        error: errors?.max1,
      },
      color: theme.green300,
      unitOptions,
      unitSelectProps: {
        name: 'First unit select',
        value: unit,
      },
    },
    {
      maxKey: ThresholdMaxKeys.MAX_2,
      minInputProps: {
        name: 'secondMinimum',
        value: maxOneValue,
        'aria-label': 'Second Minimum',
      },
      maxInputProps: {
        name: 'secondMaximum',
        value: maxTwoValue,
        'aria-label': 'Second Maximum',
        error: errors?.max2,
      },
      color: theme.yellow300,
      unitOptions,
      unitSelectProps: {
        name: 'Second unit select',
        value: unit,
        disabled: true,
      },
    },
    {
      minInputProps: {
        name: 'thirdMinimum',
        value: maxTwoValue,
        'aria-label': 'Third Minimum',
      },
      maxInputProps: {
        name: 'thirdMaximum',
        disabled: true,
        placeholder: t('No max'),
        'aria-label': 'Third Maximum',
      },
      color: theme.red300,
      unitOptions,
      unitSelectProps: {
        name: 'Third unit select',
        value: unit,
        disabled: true,
      },
    },
  ];

  return (
    <ThresholdsContainer>
      {thresholdRowProps.map((props, index) => (
        <ThresholdRow
          {...props}
          onThresholdChange={onThresholdChange}
          onUnitChange={onUnitChange}
          key={index}
        />
      ))}
    </ThresholdsContainer>
  );
}

function ThresholdsStep({
  thresholdsConfig,
  onThresholdChange,
  onUnitChange,
  errors,
  dataType = '',
  dataUnit = '',
}: ThresholdsStepProps) {
  return (
    <BuildStep
      title={t('Set thresholds')}
      description={tct(
        'Set thresholds to identify problematic widgets. For example: setting the max values, [thresholdValues] will display a green indicator for results in the range [greenRange], a yellow indicator for results in the range [yellowRange] and a red indicator for results above [redValue].',
        {
          thresholdValues: <HighlightedText>(green: 100, yellow: 200)</HighlightedText>,
          greenRange: <HighlightedText>[0 - 100]</HighlightedText>,
          yellowRange: <HighlightedText>(100 - 200]</HighlightedText>,
          redValue: <HighlightedText>200</HighlightedText>,
        }
      )}
    >
      <Thresholds
        thresholdsConfig={thresholdsConfig}
        onThresholdChange={onThresholdChange}
        onUnitChange={onUnitChange}
        errors={errors}
        dataType={dataType}
        dataUnit={dataUnit}
      />
    </BuildStep>
  );
}

const ThresholdRowWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(2)};
`;

const ThresholdsContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  margin-top: ${space(1)};

  ${FieldWrapper} {
    padding: 0;
    border-bottom: none;
  }
`;

const StyledNumberField = styled(NumberField)`
  width: 200px;
`;

const StyledSelectField = styled(SelectField)`
  min-width: 150px;
`;

export const HighlightedText = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
  color: ${p => p.theme.pink300};
`;

export default ThresholdsStep;
