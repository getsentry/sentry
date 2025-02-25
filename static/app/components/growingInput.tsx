import {forwardRef, useCallback, useEffect, useLayoutEffect, useRef} from 'react';
import styled from '@emotion/styled';

import type {InputProps} from 'sentry/components/core/input';
import {Input} from 'sentry/components/core/input';
import mergeRefs from 'sentry/utils/mergeRefs';

function createSizingDiv(referenceStyles: CSSStyleDeclaration) {
  const sizingDiv = document.createElement('div');
  sizingDiv.style.whiteSpace = 'pre';
  sizingDiv.style.width = 'auto';
  sizingDiv.style.height = '0';
  sizingDiv.style.position = 'fixed';
  sizingDiv.style.pointerEvents = 'none';
  sizingDiv.style.opacity = '0';
  sizingDiv.style.zIndex = '-1';

  sizingDiv.style.fontSize = referenceStyles.fontSize;
  sizingDiv.style.fontWeight = referenceStyles.fontWeight;
  sizingDiv.style.fontFamily = referenceStyles.fontFamily;

  return sizingDiv;
}

function resize(input: HTMLInputElement) {
  const computedStyles = window.getComputedStyle(input);

  const sizingDiv = createSizingDiv(computedStyles);
  sizingDiv.innerText = input.value || input.placeholder;
  document.body.appendChild(sizingDiv);

  const newTotalInputSize =
    sizingDiv.offsetWidth +
    // parseInt is save here as the computed styles are always in px
    parseInt(computedStyles.paddingLeft, 10) +
    parseInt(computedStyles.paddingRight, 10) +
    parseInt(computedStyles.borderWidth, 10) * 2 +
    1; // Add 1px to account for cursor width in Safari

  document.body.removeChild(sizingDiv);

  input.style.width = `${newTotalInputSize}px`;
}

export const GrowingInput = forwardRef<HTMLInputElement, InputProps>(
  function GrowingInput({onChange, ...props}: InputProps, ref) {
    const inputRef = useRef<HTMLInputElement>(null);
    const isControlled = props.value !== undefined;

    // If the input is controlled we resize it when the value prop changes
    useLayoutEffect(() => {
      if (isControlled && inputRef.current) {
        resize(inputRef.current);
      }
    }, [props.value, props.placeholder, isControlled, props.className, props.style]);

    // If the input is uncontrolled we resize it when the user types
    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!isControlled) {
          resize(event.target);
        }
        onChange?.(event);
      },
      [onChange, isControlled]
    );

    // If the input is uncontrolled we resize it when it is mounted (default value)
    useEffect(() => {
      if (!isControlled && inputRef.current) {
        resize(inputRef.current);
      }
    }, [isControlled]);

    return (
      <StyledInput {...props} ref={mergeRefs([ref, inputRef])} onChange={handleChange} />
    );
  }
);

const StyledInput = styled(Input)`
  width: 0;
`;
