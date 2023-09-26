import styled from '@emotion/styled';

import CircleIndicator from 'sentry/components/circleIndicator';
import NumberInput, {NumberInputProps} from 'sentry/components/numberInput';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import theme from 'sentry/utils/theme';

import {BuildStep} from '../buildStep';

// type ThresholdsStepProps = {
//   thresholdsConfig: ThresholdsConfig;
// };

type ThresholdRowProp = {
  color: string;
  maxInputProps?: NumberInputProps;
  minInputProps?: NumberInputProps;
};

export enum ThresholdMaxKeys {
  MAX_1 = 'max_1',
  MAX_2 = 'max_2',
}

type ThresholdMaxValues = {
  [ThresholdMaxKeys.MAX_1]: number;
  [ThresholdMaxKeys.MAX_2]: number;
};

export type ThresholdsConfig = {
  max_values: ThresholdMaxValues;
  unit: string | null;
} | null;

const WIDGET_INDICATOR_SIZE = 15;

function ThresholdRow({color, minInputProps, maxInputProps}: ThresholdRowProp) {
  return (
    <ThresholdRowWrapper>
      <CircleIndicator color={color} size={WIDGET_INDICATOR_SIZE} />
      <NumberInput {...minInputProps} />
      {t('to')}
      <NumberInput {...maxInputProps} />
    </ThresholdRowWrapper>
  );
}

function ThresholdsStep() {
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
          minInputProps={{
            disabled: true,
            value: 0,
          }}
          color={theme.green300}
        />
        <ThresholdRow
          minInputProps={{
            disabled: true,
          }}
          color={theme.yellow300}
        />
        <ThresholdRow
          minInputProps={{
            disabled: true,
          }}
          maxInputProps={{
            disabled: true,
            placeholder: t('No max'),
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
`;

const HighlightedText = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
  color: ${p => p.theme.pink300};
`;

export default ThresholdsStep;
