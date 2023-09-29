import styled from '@emotion/styled';

import CircleIndicator from 'sentry/components/circleIndicator';
import FieldWrapper from 'sentry/components/forms/fieldGroup/fieldWrapper';
import NumberField, {NumberFieldProps} from 'sentry/components/forms/fields/numberField';
import SelectField, {SelectFieldProps} from 'sentry/components/forms/fields/selectField';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import theme from 'sentry/utils/theme';
import {getThresholdUnitSelectOptions} from 'sentry/views/dashboards/utils';

import {BuildStep} from '../buildStep';

type ThresholdsStepProps = {
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
  MAX_1 = 'max_1',
  MAX_2 = 'max_2',
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
      <NumberField {...minInputProps} inline={false} disabled />
      {t('to')}
      <NumberField onChange={handleChange} {...maxInputProps} inline={false} />
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

function ThresholdsStep({
  thresholdsConfig,
  onThresholdChange,
  onUnitChange,
  dataType = '',
  dataUnit = '',
}: ThresholdsStepProps) {
  const maxOneValue = thresholdsConfig?.max_values[ThresholdMaxKeys.MAX_1] ?? '';
  const maxTwoValue = thresholdsConfig?.max_values[ThresholdMaxKeys.MAX_2] ?? '';
  const unit = thresholdsConfig?.unit ?? dataUnit;
  const unitOptions = ['duration', 'rate'].includes(dataType)
    ? getThresholdUnitSelectOptions(dataType)
    : [];

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
      <ThresholdsContainer>
        <ThresholdRow
          maxKey={ThresholdMaxKeys.MAX_1}
          minInputProps={{
            name: 'firstMinimum',
            value: 0,
            'aria-label': 'First Minimum',
          }}
          maxInputProps={{
            name: 'firstMaximum',
            value: maxOneValue,
            'aria-label': 'First Maximum',
          }}
          color={theme.green300}
          onThresholdChange={onThresholdChange}
          onUnitChange={onUnitChange}
          unitOptions={unitOptions}
          unitSelectProps={{
            name: 'First unit select',
            value: unit,
          }}
        />
        <ThresholdRow
          maxKey={ThresholdMaxKeys.MAX_2}
          minInputProps={{
            name: 'secondMinimum',
            value: maxOneValue,
            'aria-label': 'Second Minimum',
          }}
          maxInputProps={{
            name: 'secondMaximum',
            value: maxTwoValue,
            'aria-label': 'Second Maximum',
          }}
          color={theme.yellow300}
          onThresholdChange={onThresholdChange}
          unitOptions={unitOptions}
          unitSelectProps={{
            name: 'Second unit select',
            value: unit,
            disabled: true,
          }}
        />
        <ThresholdRow
          minInputProps={{
            name: 'thirdMinimum',
            value: maxTwoValue,
            'aria-label': 'Third Minimum',
          }}
          maxInputProps={{
            name: 'thirdMaximum',
            disabled: true,
            placeholder: t('No max'),
            'aria-label': 'Third Maximum',
          }}
          color={theme.red300}
          unitOptions={unitOptions}
          unitSelectProps={{
            name: 'Third unit select',
            value: unit,
            disabled: true,
          }}
        />
      </ThresholdsContainer>
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

const StyledSelectField = styled(SelectField)`
  min-width: 150px;
`;

const HighlightedText = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
  color: ${p => p.theme.pink300};
`;

export default ThresholdsStep;
