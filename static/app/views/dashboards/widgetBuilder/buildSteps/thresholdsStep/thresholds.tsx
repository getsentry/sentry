import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {CircleIndicator} from 'sentry/components/circleIndicator';
import {RadioGroup} from 'sentry/components/forms/controls/radioGroup';
import {FieldWrapper} from 'sentry/components/forms/fieldGroup/fieldWrapper';
import type {NumberFieldProps} from 'sentry/components/forms/fields/numberField';
import {NumberField} from 'sentry/components/forms/fields/numberField';
import type {SelectFieldProps} from 'sentry/components/forms/fields/selectField';
import {SelectField} from 'sentry/components/forms/fields/selectField';
import type {Polarity} from 'sentry/components/percentChange';
import {t} from 'sentry/locale';
import {getThresholdUnitSelectOptions} from 'sentry/views/dashboards/utils';
import {
  NEGATIVE_POLARITY_COLOR_ORDER,
  POSITIVE_POLARITY_COLOR_ORDER,
} from 'sentry/views/dashboards/widgetBuilder/buildSteps/thresholdsStep/constants';

type ThresholdErrors = Partial<Record<ThresholdMaxKeys, string>>;

type ThresholdsStepProps = {
  onThresholdChange: (maxKey: ThresholdMaxKeys, value: string) => void;
  onUnitChange: (unit: string) => void;
  thresholdsConfig: ThresholdsConfig | null;
  dataType?: string;
  dataUnit?: string;
  errors?: ThresholdErrors;
  onPolarityChange?: (polarity: Polarity) => void;
  onThresholdTimeWindowChange?: (timeWindow: string | undefined) => void;
  preferredPolarity?: Polarity;
  showThresholdTimeWindow?: boolean;
  thresholdTimeWindowDisabled?: boolean;
};

type ThresholdRowProp = {
  color: string;
  maxInputProps: NumberFieldProps;
  minInputProps: NumberFieldProps;
  unitOptions: Array<{label: string; value: string}>;
  unitSelectProps: SelectFieldProps<any>;
  maxKey?: ThresholdMaxKeys;
  onThresholdChange?: (maxKey: ThresholdMaxKeys, value: string) => void;
  onUnitChange?: (maxKey: ThresholdMaxKeys, value: string) => void;
};

enum ThresholdMaxKeys {
  MAX_1 = 'max1',
  MAX_2 = 'max2',
}

type ThresholdMaxValues = Partial<Record<ThresholdMaxKeys, number>>;

export type ThresholdsConfig = {
  max_values: ThresholdMaxValues | undefined;
  unit: string | null;
  preferredPolarity?: Polarity;
  timeWindow?: string | null;
};

const WIDGET_INDICATOR_SIZE = 15;
const FIXED_THRESHOLD_TIME_WINDOW = 'fixed';
const THRESHOLD_TIME_WINDOW_OPTIONS = [
  {value: FIXED_THRESHOLD_TIME_WINDOW, label: t('Fixed')},
  {value: '1m', label: t('1 minute')},
  {value: '5m', label: t('5 minutes')},
  {value: '10m', label: t('10 minutes')},
  {value: '30m', label: t('30 minutes')},
  {value: '1h', label: t('1 hour')},
  {value: '3h', label: t('3 hours')},
  {value: '6h', label: t('6 hours')},
  {value: '12h', label: t('12 hours')},
  {value: '1d', label: t('1 day')},
];

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
    <Flex align="center" gap="xl">
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
    </Flex>
  );
}

export function Thresholds({
  thresholdsConfig,
  onThresholdChange,
  onUnitChange,
  errors,
  dataType = '',
  dataUnit = '',
  preferredPolarity = '-',
  onPolarityChange,
  onThresholdTimeWindowChange,
  showThresholdTimeWindow = false,
  thresholdTimeWindowDisabled = false,
}: ThresholdsStepProps) {
  const theme = useTheme();
  const maxOneValue = thresholdsConfig?.max_values?.[ThresholdMaxKeys.MAX_1] ?? '';
  const maxTwoValue = thresholdsConfig?.max_values?.[ThresholdMaxKeys.MAX_2] ?? '';
  const unit = thresholdsConfig?.unit ?? dataUnit;
  const unitOptions = getThresholdUnitSelectOptions(dataType);
  const thresholdTimeWindow = thresholdsConfig?.timeWindow ?? FIXED_THRESHOLD_TIME_WINDOW;
  const thresholdTimeWindowOptions = THRESHOLD_TIME_WINDOW_OPTIONS.some(
    option => option.value === thresholdTimeWindow
  )
    ? THRESHOLD_TIME_WINDOW_OPTIONS
    : [
        ...THRESHOLD_TIME_WINDOW_OPTIONS,
        {value: thresholdTimeWindow, label: thresholdTimeWindow},
      ];

  const isHigherBetter = preferredPolarity === '+';

  const rowColors = isHigherBetter
    ? POSITIVE_POLARITY_COLOR_ORDER
    : NEGATIVE_POLARITY_COLOR_ORDER;

  const bottomColor = theme.colors[rowColors[0]];
  const middleColor = theme.colors[rowColors[1]];
  const topColor = theme.colors[rowColors[2]];

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
      color: bottomColor,
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
      color: middleColor,
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
      color: topColor,
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
      <RadioGroup
        label={t('Preferred polarity')}
        value={preferredPolarity || '-'}
        onChange={value => onPolarityChange?.(value)}
        orientInline
        choices={[
          ['-', t('Lower is better')],
          ['+', t('Higher is better')],
        ]}
      />
      {showThresholdTimeWindow && (
        <StyledThresholdTimeWindowField
          name="thresholdTimeWindow"
          label={t('Interval')}
          help={t(
            'Threshold values are defined for this interval and scale to match the dashboard interval.'
          )}
          showHelpInTooltip
          value={thresholdTimeWindow}
          disabled={thresholdTimeWindowDisabled}
          onChange={(value: unknown) => {
            if (typeof value !== 'string') {
              return;
            }

            onThresholdTimeWindowChange?.(
              value === FIXED_THRESHOLD_TIME_WINDOW ? undefined : value
            );
          }}
          options={thresholdTimeWindowOptions}
          inline={false}
        />
      )}
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

const ThresholdsContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};
  margin-top: ${p => p.theme.space.md};

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

const StyledThresholdTimeWindowField = styled(SelectField)`
  width: 200px;
`;

export const HighlightedText = styled('span')`
  font-family: ${p => p.theme.font.family.mono};
  color: ${p => p.theme.colors.pink400};
`;
