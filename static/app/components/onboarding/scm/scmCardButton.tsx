import styled from '@emotion/styled';

const CardButton = styled('button')`
  appearance: none;
  background: transparent;
  border: none;
  padding: 0;
  text-align: left;
  cursor: pointer;

  &[aria-disabled='true'] {
    cursor: not-allowed;
  }
`;

interface ScmCardButtonProps extends Omit<
  React.ComponentProps<typeof CardButton>,
  'disabled'
> {
  /**
   * Rendered as aria-disabled rather than disabled, so the card stays
   * focusable and a tooltip that says why it is disabled opens on focus.
   * Activating it does nothing: onClick is dropped while disabled.
   */
  disabled?: boolean;
}

/**
 * A button with all default browser styling removed.
 * Use when wrapping a Container or other visual primitive that
 * provides its own appearance but needs click/keyboard semantics.
 *
 * Defaults to `type="button"` so a card inside a form (see
 * ScmCreateProject) neither submits it on click nor becomes the form's
 * default button for Enter in a text field.
 */
export function ScmCardButton({
  type = 'button',
  disabled,
  onClick,
  ...props
}: ScmCardButtonProps) {
  return (
    <CardButton
      type={type}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      {...props}
    />
  );
}
