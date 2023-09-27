import styled from '@emotion/styled';

import CircleIndicator from 'sentry/components/circleIndicator';
import NumberInput, {NumberInputProps} from 'sentry/components/numberInput';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import theme from 'sentry/utils/theme';

import {BuildStep} from '../buildStep';

type ThresholdsStepProps = {
  onChange: (maxKey: ThresholdMaxKeys, value: string) => void;
  thresholdsConfig: ThresholdsConfig | null;
};

type ThresholdRowProp = {
  color: string;
  maxInputProps?: NumberInputProps;
  maxKey?: ThresholdMaxKeys;
  minInputProps?: NumberInputProps;
  onChange?: (maxKey: ThresholdMaxKeys, value: string) => void;
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
  unit?: string;
};

const WIDGET_INDICATOR_SIZE = 15;

function ThresholdRow({
  color,
  minInputProps,
  maxInputProps,
  onChange,
  maxKey,
}: ThresholdRowProp) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange && maxKey) {
      onChange(maxKey, e.target.value);
    }
  };

  return (
    <ThresholdRowWrapper>
      <CircleIndicator color={color} size={WIDGET_INDICATOR_SIZE} />
      <NumberInput {...minInputProps} />
      {t('to')}
      <NumberInput onInput={handleChange} {...maxInputProps} />
    </ThresholdRowWrapper>
  );
}

function ThresholdsStep({thresholdsConfig, onChange}: ThresholdsStepProps) {
  return (
    <BuildStep
      title={t('Set thresholds')}
      description={tct(
        'Set thresholds to identify problematic widgets. For example: setting the max values, [thresholdValues] will display a green indicator for results in the range [greenRange], a yellow indicator for the range [yellowRange] and a red indicator for results above [redValue].',
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
            disabled: true,
            value: 0,
            'aria-label': 'First Minimum',
          }}
          maxInputProps={{
            value: thresholdsConfig?.max_values[ThresholdMaxKeys.MAX_1],
            'aria-label': 'First Maximum',
          }}
          color={theme.green300}
          onChange={onChange}
        />
        <ThresholdRow
          maxKey={ThresholdMaxKeys.MAX_2}
          minInputProps={{
            disabled: true,
            value: thresholdsConfig?.max_values[ThresholdMaxKeys.MAX_1],
            'aria-label': 'Second Minimum',
          }}
          maxInputProps={{
            value: thresholdsConfig?.max_values[ThresholdMaxKeys.MAX_2],
            'aria-label': 'Second Maximum',
          }}
          color={theme.yellow300}
          onChange={onChange}
        />
        <ThresholdRow
          minInputProps={{
            disabled: true,
            value: thresholdsConfig?.max_values[ThresholdMaxKeys.MAX_2],
            'aria-label': 'Third Minimum',
          }}
          maxInputProps={{
            disabled: true,
            placeholder: t('No max'),
            'aria-label': 'Third Maximum',
          }}
          color={theme.red300}
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
`;

const HighlightedText = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
  color: ${p => p.theme.pink300};
`;

export default ThresholdsStep;
