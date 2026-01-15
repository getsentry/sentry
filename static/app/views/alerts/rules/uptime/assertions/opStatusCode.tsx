import {useId} from 'react';

import {SelectTrigger} from '@sentry/scraps/compactSelect/trigger';
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
            trigger={triggerProps => (
              <SelectTrigger.Button
                {...triggerProps}
                size="zero"
                borderless
                showChevron={false}
              >
                <Text monospace>{selectedOption?.symbol ?? ''}</Text>
              </SelectTrigger.Button>
            )}
          />
        </InputGroup.LeadingItems>
        <InputGroup.Input
          id={inputId}
          type="number"
          value={value.value}
          min={100}
          max={599}
          onChange={e => {
            const newValue = parseInt(e.target.value, 10);
            if (!isNaN(newValue)) {
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
