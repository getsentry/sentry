import {InputGroup} from '@sentry/scraps/input';
import {Text} from '@sentry/scraps/text';

import {tct} from 'sentry/locale';

function parseWholeNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : null;
}

/**
 * A whole-dollar amount of Seer credits, showing how many credits it buys.
 */
export function DollarInput({
  cents,
  creditPriceCents,
  onChange,
  ...inputProps
}: {
  cents: number | null;
  creditPriceCents: number;
  /**
   * Called with null when the input is cleared.
   */
  onChange: (cents: number | null) => void;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-label'?: string;
  id?: string;
  placeholder?: string;
}) {
  return (
    <InputGroup>
      <InputGroup.LeadingItems disablePointerEvents>
        <Text variant="muted">$</Text>
      </InputGroup.LeadingItems>
      <InputGroup.Input
        {...inputProps}
        inputMode="numeric"
        value={cents === null ? '' : (cents / 100).toLocaleString()}
        onChange={e => {
          const dollars = parseWholeNumber(e.target.value);
          onChange(dollars === null ? null : dollars * 100);
        }}
      />
      {cents !== null && (
        <InputGroup.TrailingItems disablePointerEvents>
          <Text variant="muted">
            {tct('[credits] credits', {
              credits: Math.floor(cents / creditPriceCents).toLocaleString(),
            })}
          </Text>
        </InputGroup.TrailingItems>
      )}
    </InputGroup>
  );
}
