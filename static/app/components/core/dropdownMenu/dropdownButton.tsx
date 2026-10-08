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
  // Overrides the button's medium weight next to a prefix.
  prefixed: {
    fontWeight: fontWeight.sansRegular,
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

export function DropdownButton({
  children,
  prefix,
  size,
  isOpen = false,
  showChevron = true,
  disabled = false,
  ref,
  xstyle,
  ...props
}: DropdownButtonProps) {
  return (
    <Button
      aria-haspopup="true"
      aria-expanded={isOpen}
      disabled={disabled}
      size={size}
      ref={ref}
      {...props}
      xstyle={[
        styles.button,
        (isOpen || disabled) && styles.flat,
        !!prefix && styles.prefixed,
        xstyle,
      ]}
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
