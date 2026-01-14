import {useId} from 'react';

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
          value={value.value}
          onChange={e => {
            // Only allow numeric input
            const inputValue = e.target.value;
            if (inputValue === '' || /^\d+$/.test(inputValue)) {
              const newValue = inputValue === '' ? 0 : parseInt(inputValue, 10);
              // Clamp status code to valid HTTP range (100-599)
              const clampedValue = Math.max(100, Math.min(599, newValue));
              onChange({...value, value: clampedValue});
            }
          }}
          placeholder="code"
          monospace
          width="100%"
        />
      </InputGroup>
    </OpContainer>
  );
}
