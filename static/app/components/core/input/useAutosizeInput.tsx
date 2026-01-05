import type React from 'react';
import {useCallback, useLayoutEffect, useRef} from 'react';

const defaultOnResize = (
  inputRef: HTMLInputElement,
  size: {height: number; width: number}
) => {
  inputRef.style.width = `${size.width}px`;
};

/**
 * This hook is used to automatically resize an input element based on its content.
 * It is useful for creating "growing" inputs that can resize to fit their content.
 *
 * @param options - Options for the autosize input functionality.
 * @param options.disabled - Set to `true` to disable the autosizing.
 * @param options.onResize - A callback to be called when the input is resized with the
 * new size. If not provided, the input will be resized to fit its content.
 * @param options.value - The value of the input, use when the input is controlled.
 * @returns A ref callback for the input element.
 */

interface UseAutosizeInputOptions {
  enabled?: boolean;
  onResize?: (sourceRef: HTMLInputElement, size: {height: number; width: number}) => void;
  value?: React.InputHTMLAttributes<HTMLInputElement>['value'] | undefined;
}

export function useAutosizeInput(
  options?: UseAutosizeInputOptions
): React.RefCallback<HTMLInputElement> {
  const enabled = options?.enabled ?? true;
  const sourceRef = useRef<HTMLInputElement | null>(null);

  const onResize = options?.onResize ?? defaultOnResize;

  // A controlled input value change does not trigger a change event,
  // so we need to manually observe the value...
  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }

    if (sourceRef.current) {
      const size = getInputSize(sourceRef.current);
      onResize(sourceRef.current, size);
    }
  }, [options?.value, enabled, onResize]);

  const onInputChange = useCallback(
    (_event: any) => {
      if (sourceRef.current) {
        const size = getInputSize(sourceRef.current);
        onResize(sourceRef.current, size);
      }
    },
    [onResize]
  );

  const autosizingCallbackRef: React.RefCallback<HTMLInputElement> = useCallback(
    (element: HTMLInputElement | null) => {
      if (!enabled || !element) {
        sourceRef.current?.removeEventListener('input', onInputChange);
      } else {
        const size = getInputSize(element);
        onResize(element, size);
        element.addEventListener('input', onInputChange);
      }

      sourceRef.current = element;
    },
    [onInputChange, enabled, onResize]
  );

  return autosizingCallbackRef;
}

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

function getInputSize(input: HTMLInputElement) {
  const computedStyles = getComputedStyle(input);

  const sizingDiv = createSizingDiv(computedStyles);
  sizingDiv.innerText = input.value || input.placeholder;
  document.body.appendChild(sizingDiv);

  const newTotalInputSize =
    sizingDiv.offsetWidth +
    // parseInt is save here as the computed styles are always in px
    parseInt(computedStyles.paddingLeft ?? 0, 10) +
    parseInt(computedStyles.paddingRight ?? 0, 10) +
    parseInt(computedStyles.borderWidth ?? 0, 10) * 2 +
    1; // Add 1px to account for cursor width in Safari

  document.body.removeChild(sizingDiv);

  return {width: newTotalInputSize, height: input.offsetHeight};
}
