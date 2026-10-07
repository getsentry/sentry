import * as stylex from '@stylexjs/stylex';
import type {DistributedOmit} from 'type-fest';

import type {ButtonProps} from '@sentry/scraps/button';
import {Button} from '@sentry/scraps/button';
import {fontWeight, space} from '@sentry/scraps/theme/constants.stylex';

import {IconChevron} from 'sentry/icons';

export type DropdownButtonProps = DistributedOmit<
  ButtonProps,
  'type' | 'prefix' | 'onClick'
> & {
  /**
   * Whether or not the button should render as open
   */
  isOpen?: boolean;
  /**
   * The fixed prefix text to show in the button eg: 'Sort By'
   */
  prefix?: React.ReactNode;
  /**
   * Should a chevron icon be shown?
   */
  showChevron?: boolean;
};

const styles = stylex.create({
  button: {
    maxWidth: '100%',
  },
  flat: {
    boxShadow: 'none',
  },
  label: {
    fontWeight: fontWeight.sansMedium,
    paddingRight: space.sm,
    '::after': {
      content: '":"',
    },
  },
  chevron: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 'auto',
    paddingLeft: space.xs,
    flexShrink: 0,
  },
});

// Button sets its own font weight with a class. Two classes for one property
// are ordered by the generated stylesheet rather than by the class list, so
// the regular weight next to a prefix is set inline instead.
const PREFIXED_STYLE: React.CSSProperties = {fontWeight: fontWeight.sansRegular};

export function DropdownButton({
  children,
  prefix,
  size,
  isOpen = false,
  showChevron = true,
  disabled = false,
  ref,
  className,
  style,
  ...props
}: DropdownButtonProps) {
  const sx = stylex.props(styles.button, (isOpen || disabled) && styles.flat);

  return (
    <Button
      aria-haspopup="true"
      aria-expanded={isOpen}
      disabled={disabled}
      size={size}
      ref={ref}
      {...props}
      className={className ? `${sx.className} ${className}` : sx.className}
      style={prefix ? {...PREFIXED_STYLE, ...style} : style}
    >
      {prefix && <span {...stylex.props(styles.label)}>{prefix}</span>}
      {children}
      {showChevron && (
        <div {...stylex.props(styles.chevron)}>
          <IconChevron
            variant={(props.variant ?? 'secondary') === 'secondary' ? 'muted' : undefined}
            direction={isOpen ? 'up' : 'down'}
            size={size === 'zero' || size === 'xs' ? 'xs' : 'sm'}
          />
        </div>
      )}
    </Button>
  );
}
