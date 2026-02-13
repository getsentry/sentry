import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {Flex} from '@sentry/scraps/layout';
import {Slider} from '@sentry/scraps/slider';
import {Tooltip} from '@sentry/scraps/tooltip';

import {BaseField, useFieldStateIndicator, type BaseFieldProps} from './baseField';

interface RangeFieldProps {
  onChange: (value: number) => void;
  value: number;
  disabled?: boolean | string;
  formatLabel?: (value: number | '') => React.ReactNode;
  max?: number;
  min?: number;
  step?: number;
}

export function RangeField({
  onChange,
  disabled,
  ...props
}: BaseFieldProps & RangeFieldProps) {
  const autoSaveContext = useAutoSaveContext();
  const indicator = useFieldStateIndicator();
  const isDisabled = !!disabled || autoSaveContext?.status === 'pending';
  const disabledReason = typeof disabled === 'string' ? disabled : undefined;

  return (
    <BaseField>
      {fieldProps => {
        const slider = (
          <Flex gap="sm" align="center">
            <Slider
              {...fieldProps}
              {...props}
              disabled={isDisabled}
              onChange={(value: number) => onChange(value)}
            />
            <Flex>{indicator}</Flex>
          </Flex>
        );

        if (disabledReason) {
          return <Tooltip title={disabledReason}>{slider}</Tooltip>;
        }

        return slider;
      }}
    </BaseField>
  );
}
