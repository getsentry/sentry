import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';

type ChipSize = 'xs' | 'sm' | 'md';

interface ChipBaseProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Called when the dismiss affordance is activated. Providing it renders a
   * trailing ✕ button; omit it for a static chip.
   */
  onDismiss?: () => void;
  size?: ChipSize;
  value?: string;
}

/**
 * A search-filter token rendered as `property operator value`.
 * - `query`: value emphasized in accent — an editable search-filter token.
 * - `readonly-query`: value in secondary — a non-interactive summary of a filter.
 */
interface QueryChipProps extends ChipBaseProps {
  /**
   * The comparison operator shown between property and value (e.g. `is`).
   */
  operator?: string;
  /**
   * The filter key, shown first.
   */
  property?: string;
  variant?: 'query' | 'readonly-query';
}

/**
 * A standalone token showing just the `value`, in primary. `property` and
 * `operator` are not applicable.
 */
interface ValueChipProps extends ChipBaseProps {
  variant: 'value';
  operator?: never;
  property?: never;
}

type ChipProps = QueryChipProps | ValueChipProps;

const SIZES = {
  xs: {height: '20px', radius: '2xs', pad: 'xs', font: '12px', dismiss: '20px'},
  sm: {height: '24px', radius: 'xs', pad: 'sm', font: '14px', dismiss: '20px'},
  md: {height: '28px', radius: 'sm', pad: 'md', font: '14px', dismiss: '24px'},
} as const;

/**
 * A compact, chonky-embossed token for search filters and standalone values.
 *
 * Renders `property operator value` (the query variants) or a lone `value`, in
 * three sizes. Pass `onDismiss` to make it removable. Presentation only — it
 * holds no filter state; the caller owns the values and dismiss behavior.
 */
export function Chip({
  size = 'md',
  variant = 'query',
  property,
  operator = 'is',
  value,
  onDismiss,
  ...rest
}: ChipProps) {
  const isQuery = variant === 'query' || variant === 'readonly-query';
  const valueTone =
    variant === 'query'
      ? 'accent'
      : variant === 'readonly-query'
        ? 'secondary'
        : 'primary';

  return (
    <ChipRoot chipSize={size} dismissable={Boolean(onDismiss)} {...rest}>
      <Flex align="center" gap="xs" padding="2xs 0">
        {isQuery && property !== undefined && <Label tone="primary">{property}</Label>}
        {isQuery && operator && <Label tone="secondary">{operator}</Label>}
        {value !== undefined && <Label tone={valueTone}>{value}</Label>}
      </Flex>
      {onDismiss ? (
        <DismissButton
          chipSize={size}
          type="button"
          onClick={onDismiss}
          aria-label={t('Remove')}
        >
          <IconClose size="xs" />
        </DismissButton>
      ) : null}
    </ChipRoot>
  );
}

const ChipRoot = styled('div')<{chipSize: ChipSize; dismissable: boolean}>`
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  overflow: hidden;
  height: ${p => SIZES[p.chipSize].height};
  padding-left: ${p => p.theme.space[SIZES[p.chipSize].pad]};
  padding-right: ${p => (p.dismissable ? '0' : p.theme.space[SIZES[p.chipSize].pad])};
  border: 1px solid ${p => p.theme.tokens.interactive.chonky.embossed.neutral.chonk};
  border-radius: ${p => p.theme.radius[SIZES[p.chipSize].radius]};
  background: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.background};
  box-shadow: 0 1px 0 0 ${p => p.theme.tokens.interactive.chonky.embossed.neutral.chonk};
  font-size: ${p => SIZES[p.chipSize].font};
  line-height: 16px;
`;

const Label = styled('span')<{tone: 'primary' | 'secondary' | 'accent'}>`
  color: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.content[p.tone]};
  white-space: nowrap;
`;

const DismissButton = styled('button')<{chipSize: ChipSize}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  width: ${p => SIZES[p.chipSize].dismiss};
  padding: 0 ${p => p.theme.space.xs};
  margin: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.content.secondary};

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
    color: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.content.primary};
  }
`;
