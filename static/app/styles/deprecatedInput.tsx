import {css, Theme} from '@emotion/react';

/**
 * Inner padding for inputs. This is deprecated. If necessary, use the values
 * in `theme.formPadding` instead. Be sure to specify the input size, e.g.
 * `theme.formPadding.md.paddingLeft`.
 *
 * @deprecated
 */
export const INPUT_PADDING = 10;

type Props = {
  theme: Theme;
  disabled?: boolean;
  monospace?: boolean;
  readOnly?: boolean;
};

/**
 * Styles for inputs/textareas. This is deprecated. Consider these
 * alternatives:
 *
 * - [Strongly Recommended] Use the existing form components, such as:
 *   + <Input /> from 'sentry/components/input'
 *   + <Textarea /> from 'sentry/components/forms/controls/textarea'
 *   + <TextCopyInput /> from 'sentry/components/textCopyInput'
 *   + …
 *
 * - Import `inputStyles` as a named import from 'sentry/components/input'.
 * This is only meant for use in core, reusable components. It should rarely
 * be used elsewhere (chances are you don't want all the styles that it comes
 * with).
 *
 * @deprecated
 */
const inputStyles = (props: Props) => css`
  color: ${props.disabled ? props.theme.disabled : props.theme.formText};
  display: block;
  width: 100%;
  background: ${props.theme.background};
  border: 1px solid ${props.theme.border};
  border-radius: ${props.theme.borderRadius};
  box-shadow: inset ${props.theme.dropShadowMedium};
  padding: ${INPUT_PADDING}px;
  resize: vertical;
  height: 40px;
  transition:
    border 0.1s,
    box-shadow 0.1s;

  ${props.monospace ? `font-family: ${props.theme.text.familyMono}` : ''};

  ${props.readOnly
    ? css`
        cursor: default;
      `
    : ''};

  &::placeholder {
    color: ${props.theme.formPlaceholder};
  }

  &[disabled] {
    background: ${props.theme.backgroundSecondary};
    color: ${props.theme.gray300};
    border: 1px solid ${props.theme.border};
    cursor: not-allowed;

    &::placeholder {
      color: ${props.theme.disabled};
    }
  }

  &:focus,
  &.focus-visible {
    outline: none;
    border-color: ${props.theme.focusBorder};
    box-shadow: ${props.theme.focusBorder} 0 0 0 1px;
  }
`;

export {inputStyles};
