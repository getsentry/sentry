import {useId, type ChangeEventHandler, type FocusEventHandler} from 'react';

import {InputGroup} from '@sentry/scraps/input/inputGroup';
import {Text} from '@sentry/scraps/text';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import type {StatusCodeOp} from 'sentry/views/alerts/rules/uptime/types';

import {COMPARISON_OPTIONS, OpContainer} from './opCommon';

interface AssertionOpStatusCodeProps {
  onChange: (op: StatusCodeOp) => void;
  onRemove: () => void;
  value: StatusCodeOp;
}

export function AssertionOpStatusCode({
  value,
  onChange,
  onRemove,
}: AssertionOpStatusCodeProps) {
  const inputId = useId();

  // Filter out 'always' and 'never' which are not valid for status code checks
  const statusCodeOptions = COMPARISON_OPTIONS.filter(
    opt => !['always', 'never'].includes(opt.value)
  );
  const selectedOption = statusCodeOptions.find(opt => opt.value === value.operator.cmp);

  const handleInputChange: ChangeEventHandler<HTMLInputElement> = e => {
    const rawValue = e.target.value;
    // Only allow digits, up to 3 characters
    if (!/^\d*$/.test(rawValue) || rawValue.length > 3) {
      return;
    }
    let newValue = parseInt(rawValue, 10);
    // Clamp to valid HTTP range when user has entered a complete 3-digit code
    // This prevents the race condition where submitting before blur could send invalid values
    if (rawValue.length === 3) {
      newValue = Math.max(100, Math.min(599, newValue));
    }
    onChange({...value, value: newValue});
  };

  const handleInputBlur: FocusEventHandler<HTMLInputElement> = e => {
    const newValue = parseInt(e.target.value, 10);
    // Clamp status code to valid HTTP range (100-599) on blur
    // eslint-disable-next-line no-console
    console.log('[STATUS CODE] blur fired, raw value:', e.target.value, 'parsed:', newValue);
    if (isNaN(newValue)) {
      // eslint-disable-next-line no-console
      console.log('[STATUS CODE] blur: resetting NaN to 100');
      onChange({...value, value: 100});
    } else {
      const clampedValue = Math.max(100, Math.min(599, newValue));
      if (clampedValue !== value.value) {
        // eslint-disable-next-line no-console
        console.log('[STATUS CODE] blur: clamping', newValue, 'to', clampedValue);
        onChange({...value, value: clampedValue});
      }
    }
  };

  return (
    <OpContainer label={t('Status Code')} onRemove={onRemove} inputId={inputId}>
      <InputGroup>
        <InputGroup.LeadingItems>
          <CompactSelect
            size="xs"
            value={value.operator.cmp}
            onChange={option => {
              onChange({
                ...value,
                operator: {cmp: option.value},
              });
            }}
            options={statusCodeOptions}
            triggerProps={{
              size: 'zero',
              borderless: true,
              showChevron: false,
              children: <Text monospace>{selectedOption?.symbol ?? ''}</Text>,
            }}
          />
        </InputGroup.LeadingItems>
        <InputGroup.Input
          id={inputId}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={isNaN(value.value) ? '' : value.value}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          placeholder="code"
          monospace
          width="100%"
        />
      </InputGroup>
    </OpContainer>
  );
}
