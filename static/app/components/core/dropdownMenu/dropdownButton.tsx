import {css, cx} from '@linaria/core';
import {IconChevron} from '@sentry/icons/chevron';
import type {DistributedOmit} from 'type-fest';

import type {ButtonProps} from '@sentry/scraps/button';
import {Button} from '@sentry/scraps/button';

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

const styles = {
  button: css`
    max-width: 100%;
  `,
  prefixed: css`
    font-weight: 400;
  `,
  flat: css`
    box-shadow: none;
  `,
  label: css`
    font-weight: 500;
    padding-right: 6px;
    &::after {
      content: ':';
    }
  `,
  chevron: css`
    display: flex;
    align-items: center;
    margin-left: auto;
    padding-left: 4px;
    flex-shrink: 0;
  `,
};

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
  const sx = {className: cx(styles.button, (isOpen || disabled) && styles.flat)};

  return (
    <Button
      aria-haspopup="true"
      aria-expanded={isOpen}
      disabled={disabled}
      size={size}
      ref={ref}
      {...props}
      className={cx(sx.className, !!prefix && styles.prefixed, className)}
      style={style}
    >
      {prefix && <span {...{className: cx(styles.label)}}>{prefix}</span>}
      {children}
      {showChevron && (
        <div {...{className: cx(styles.chevron)}}>
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
