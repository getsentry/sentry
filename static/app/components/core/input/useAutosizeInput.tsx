import type React from 'react';
import {useCallback, useRef} from 'react';

/**
 * This hook is used to automatically resize an input element based on its content.
 * It is useful for creating "growing" inputs that can resize to fit their content.
 *
 * @param options - Options for the autosize input functionality.
 * @param options.disabled - Set to `true` to disable the autosizing.
 * @param options.value - The value of the input, use when the input is controlled.
 * @returns A ref callback for the input element.
 */
export function useAutosizeInput(
  options: UseAutosizeInputOptions = {}
): React.RefCallback<HTMLInputElement> {
  const sourceRef = useRef<HTMLInputElement | null>(null);

  const onInputChange = useCallback((_event: any) => {
    if (sourceRef.current) {
      resize(sourceRef.current);
    }
  }, []);

  const autosizingCallbackRef: React.RefCallback<HTMLInputElement> = useCallback(
    (element: HTMLInputElement | null) => {
      if (options.disabled || !element) {
        if (sourceRef.current) {
          sourceRef.current.removeEventListener('change', onInputChange);
        }
        sourceRef.current = null;
        return;
      }

      resize(element);
      element.addEventListener('value', onInputChange);
      sourceRef.current = element;
    },
    [onInputChange, options.disabled]
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

interface UseAutosizeInputOptions {
  disabled?: boolean;
  value?: React.InputHTMLAttributes<HTMLInputElement>['value'] | undefined;
}
