import styled from '@emotion/styled';

const CardButton = styled('button')`
  appearance: none;
  background: transparent;
  border: none;
  padding: 0;
  text-align: left;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
  }
`;

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
  ...props
}: React.ComponentProps<typeof CardButton>) {
  return <CardButton type={type} {...props} />;
}
