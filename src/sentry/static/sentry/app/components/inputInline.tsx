import * as React from 'react';
import styled from '@emotion/styled';

import {callIfFunction} from 'app/utils/callIfFunction';
import {IconEdit} from 'app/icons';
import space from 'app/styles/space';

type Props = {
  name: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  required?: boolean;

  placeholder?: string;
  value?: string;
} & React.DOMAttributes<HTMLInputElement>;

type State = {
  isFocused: boolean;
  isHovering: boolean;
};

/**
 * InputInline is a cool pattern and @doralchan has confirmed that this has more
 * than 50% chance of being reused elsewhere in the app. However, adding it as a
 * form component has too much overhead for Discover2, so it'll be kept outside
 * for now.
 *
 * The props for this component take some cues from InputField.tsx
 *
 * The implementation uses HTMLDivElement with `contentEditable="true"`. This is
 * because we need the width to expand along with the content inside. There
 * isn't a way to easily do this with HTMLInputElement, especially with fonts
 * which are not fixed-width.
 *
 * If you are expecting the usual HTMLInputElement, this may have some quirky
 * behaviours that'll need your help to improve.
 *
 * TODO(leedongwei): Add to storybook
 * TODO(leedongwei): Add some tests
 */
class InputInline extends React.Component<Props, State> {
  /**
   * HACK(leedongwei): ContentEditable does not have the property `value`. We
   * coerce its `innerText` to `value` so it will have similar behaviour as a
   * HTMLInputElement
   *
   * We probably need to attach this to every DOMAttribute event...
   */
  static setValueOnEvent(
    event: React.FormEvent<HTMLDivElement>
  ): React.FormEvent<HTMLInputElement> {
    const text =
      (event.target as any).innerText || (event.currentTarget as any).innerText;

    (event.target as any).value = text;
    (event.currentTarget as any).value = text;
    return event as React.FormEvent<HTMLInputElement>;
  }

  state = {
    isFocused: false,
    isHovering: false,
  };

  private refInput = React.createRef<HTMLDivElement>();

  /**
   * Used by the parent to blur/focus on the Input
   */
  blur = () => {
    if (this.refInput.current) {
      this.refInput.current.blur();
    }
  };
  /**
   * Used by the parent to blur/focus on the Input
   */
  focus = () => {
    if (this.refInput.current) {
      this.refInput.current.focus();
    }
  };

  onBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    this.setState({
      isFocused: false,
      isHovering: false,
    });

    callIfFunction(this.props.onBlur, InputInline.setValueOnEvent(event));
  };
  onFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    this.setState({isFocused: true});
    callIfFunction(this.props.onFocus, InputInline.setValueOnEvent(event));
  };

  /**
   * HACK(leedongwei): ContentEditable is not a Form element, and as such it
   * does not emit `onChange` events. This method using `onInput` and capture the
   * inner value to be passed along to an onChange function.
   */
  onChangeUsingOnInput = (event: React.FormEvent<HTMLDivElement>) => {
    callIfFunction(this.props.onChange, InputInline.setValueOnEvent(event));
  };

  onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Might make sense to add Form submission here too
    if (event.key === 'Enter') {
      // Prevents the Enter key from inserting a line-break
      event.preventDefault();

      if (this.refInput.current) {
        this.refInput.current.blur();
      }
    }

    callIfFunction(this.props.onKeyUp, InputInline.setValueOnEvent(event));
  };
  onKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && this.refInput.current) {
      this.refInput.current.blur();
    }
    callIfFunction(this.props.onKeyUp, InputInline.setValueOnEvent(event));
  };

  onMouseEnter = () => {
    this.setState({isHovering: !this.props.disabled});
  };
  onMouseMove = () => {
    this.setState({isHovering: !this.props.disabled});
  };
  onMouseLeave = () => {
    this.setState({isHovering: false});
  };

  onClickIcon = (event: React.MouseEvent<HTMLDivElement>) => {
    if (this.props.disabled) {
      return;
    }

    if (this.refInput.current) {
      this.refInput.current.focus();
    }

    callIfFunction(this.props.onClick, InputInline.setValueOnEvent(event));
  };

  render() {
    const {value, placeholder, disabled} = this.props;
    const {isFocused} = this.state;

    const innerText = value || placeholder || '';

    return (
      <Wrapper
        style={this.props.style}
        onMouseEnter={this.onMouseEnter}
        onMouseMove={this.onMouseMove}
        onMouseLeave={this.onMouseLeave}
      >
        <Input
          {...this.props} // Pass DOMAttributes props first, extend/overwrite below
          ref={this.refInput}
          suppressContentEditableWarning
          contentEditable={!this.props.disabled}
          isHovering={this.state.isHovering}
          isDisabled={this.props.disabled}
          onBlur={this.onBlur}
          onFocus={this.onFocus}
          onInput={this.onChangeUsingOnInput}
          onChange={this.onChangeUsingOnInput} // Overwrite onChange too, just to be 100% sure
          onKeyDown={this.onKeyDown}
          onKeyUp={this.onKeyUp}
        >
          {innerText}
        </Input>

        {!isFocused && !disabled && (
          <div onClick={this.onClickIcon}>
            <StyledIconEdit />
          </div>
        )}
      </Wrapper>
    );
  }
}

const Wrapper = styled('div')`
  display: inline-flex;
  align-items: center;

  vertical-align: text-bottom;
`;
const Input = styled('div')<{
  isHovering?: boolean;
  isDisabled?: boolean;
}>`
  min-width: 40px;
  margin: 0;
  border: 1px solid ${p => (p.isHovering ? p.theme.borderDark : 'transparent')};
  outline: none;

  line-height: inherit;
  border-radius: ${space(0.5)};
  background: transparent;

  &:focus,
  &:active {
    border: 1px solid ${p => (p.isDisabled ? 'transparent' : p.theme.borderLight)};
    background-color: ${p => (p.isDisabled ? 'transparent' : p.theme.gray300)};
  }
`;
const StyledIconEdit = styled(IconEdit)`
  color: ${p => p.theme.gray500};
  margin-left: ${space(0.5)};

  &:hover {
    cursor: pointer;
  }
`;

export default InputInline;
