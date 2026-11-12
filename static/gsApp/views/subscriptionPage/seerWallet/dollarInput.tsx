import {InputGroup} from '@sentry/scraps/input';
import {Text} from '@sentry/scraps/text';

import {tct} from 'sentry/locale';

function parseWholeNumber(value: string) {
  return Math.max(0, parseInt(value.replace(/\D/g, ''), 10) || 0);
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
  cents: number;
  creditPriceCents: number;
  onChange: (cents: number) => void;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-label'?: string;
  id?: string;
}) {
  return (
    <InputGroup>
      <InputGroup.LeadingItems disablePointerEvents>
        <Text variant="muted">$</Text>
      </InputGroup.LeadingItems>
      <InputGroup.Input
        {...inputProps}
        inputMode="numeric"
        value={(cents / 100).toLocaleString()}
        onChange={e => onChange(parseWholeNumber(e.target.value) * 100)}
      />
      <InputGroup.TrailingItems disablePointerEvents>
        <Text variant="muted">
          {tct('[credits] credits', {
            credits: Math.floor(cents / creditPriceCents).toLocaleString(),
          })}
        </Text>
      </InputGroup.TrailingItems>
    </InputGroup>
  );
}
