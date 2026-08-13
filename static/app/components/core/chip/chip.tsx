import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text, type TextProps} from '@sentry/scraps/text';

import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';

type ChipSize = 'xs' | 'sm' | 'md';

interface BaseChipProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  /**
   * The comparison operator shown between property and value (e.g. `is`).
   */
  operator?: string;
  /**
   * The filter key, shown first.
   */
  property?: string;
  size?: ChipSize;
}

interface DismissableChipProps extends BaseChipProps {
  /**
   * Called when the dismiss affordance is activated. Providing it renders a
   * trailing ✕ button; omit it for a static chip.
   */
  onDismiss?: () => void;
  readonly?: false;
}

interface ReadonlyChipProps extends BaseChipProps {
  /**
   * Renders a non-interactive summary: the value reads as secondary and the
   * dismiss affordance is suppressed. Readonly chips cannot be dismissed.
   */
  readonly: true;
  onDismiss?: never;
}

type ChipProps = DismissableChipProps | ReadonlyChipProps;

const SIZES = {
  xs: {height: '20px', radius: '2xs', pad: 'xs', font: 'sm', dismiss: '20px'},
  sm: {height: '24px', radius: 'xs', pad: 'sm', font: 'md', dismiss: '20px'},
  md: {height: '28px', radius: 'sm', pad: 'md', font: 'md', dismiss: '24px'},
} as const;

/**
 * A compact, chonky-embossed token for search filters and standalone values.
 *
 * Renders `property operator value` or alone `value`, in three sizes. Pass
 * `onDismiss` to make it removable, or `readonly` for a non-interactive
 * summary. Presentation only — it holds no filter state; the caller owns the
 * values and dismiss behavior.
 */
export function Chip({
  size = 'md',
  property,
  operator,
  readonly = false,
  value,
  onDismiss,
  ...rest
}: ChipProps) {
  const textSize = SIZES[size].font;
  const textVariant: TextProps<'span'>['variant'] = readonly
    ? 'secondary'
    : property === undefined
      ? 'primary'
      : 'accent';

  return (
    <ChipRoot
      display="inline-flex"
      align="center"
      overflow="hidden"
      height={SIZES[size].height}
      paddingLeft={SIZES[size].pad}
      paddingRight={onDismiss ? '0' : SIZES[size].pad}
      radius={SIZES[size].radius}
      {...rest}
    >
      <Flex align="center" gap="xs" padding="2xs 0">
        {property !== undefined && (
          <Text size={textSize} variant="primary" wrap="nowrap">
            {property}
          </Text>
        )}
        {operator && (
          <Text size={textSize} variant="secondary" wrap="nowrap">
            {operator}
          </Text>
        )}
        {value !== undefined && (
          <Text size={textSize} variant={textVariant} wrap="nowrap">
            {value}
          </Text>
        )}
      </Flex>
      {onDismiss ? (
        <DismissButton
          chipSize={size}
          size="zero"
          variant="transparent"
          icon={<IconClose />}
          onClick={e => {
            // Keep dismissing a chip from also triggering click handlers on the
            // chip itself or any ancestor (e.g. click-to-edit).
            e.stopPropagation();
            onDismiss();
          }}
          aria-label={t(
            'Remove %s',
            [property, operator, value].filter(Boolean).join(' ')
          )}
        />
      ) : null}
    </ChipRoot>
  );
}

const ChipRoot = styled(Flex)`
  box-sizing: border-box;
  border: 1px solid ${p => p.theme.tokens.interactive.chonky.embossed.neutral.chonk};
  background: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.background};
  box-shadow: 0 1px 0 0 ${p => p.theme.tokens.interactive.chonky.embossed.neutral.chonk};
  line-height: 16px;
`;

const DismissButton = styled(Button)<{chipSize: ChipSize}>`
  align-self: stretch;
  width: ${p => SIZES[p.chipSize].dismiss};
  height: auto;
  min-height: 0;
  padding: 0 ${p => p.theme.space.xs};
  border-radius: 0;
  color: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.content.secondary};

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
    color: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.content.primary};
  }
`;
