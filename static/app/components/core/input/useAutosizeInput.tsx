import type React from 'react';
import {useCallback, useLayoutEffect, useRef} from 'react';

/**
 * This hook is used to automatically resize an input element based on its content.
 * It is useful for creating "growing" inputs that can resize to fit their content.
 *
 * @param options - Options for the autosize input functionality.
 * @param options.value - The value of the input, use when the input is controlled.
 * @returns A ref callback for the input element.
 */

interface UseAutosizeInputOptions {
  value?: React.InputHTMLAttributes<HTMLInputElement>['value'] | undefined;
}

function createSizingDiv(computedStyles: {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
}) {
  const sizingDiv = document.createElement('div');
  sizingDiv.style.whiteSpace = 'pre';
  sizingDiv.style.width = 'auto';
  sizingDiv.style.height = '0';
  sizingDiv.style.position = 'fixed';
  sizingDiv.style.pointerEvents = 'none';
  sizingDiv.style.opacity = '0';
  sizingDiv.style.zIndex = '-1';

  // Initialize font styles to match the input once at creation.
  sizingDiv.style.fontSize = computedStyles.fontSize;
  sizingDiv.style.fontWeight = computedStyles.fontWeight;
  sizingDiv.style.fontFamily = computedStyles.fontFamily;
  return sizingDiv;
}

export function useAutosizeInput(
  options?: UseAutosizeInputOptions
): React.RefCallback<HTMLInputElement> {
  const sourceRef = useRef<HTMLInputElement | null>(null);
  // Cache the sizing div per hook instance to avoid create/destroy on every resize
  const sizingDivRef = useRef<HTMLDivElement | null>(null);

  // Cleanup sizing div on unmount
  useLayoutEffect(() => {
    return () => {
      if (sizingDivRef.current?.parentNode) {
        sizingDivRef.current.parentNode.removeChild(sizingDivRef.current);
        sizingDivRef.current = null;
      }
    };
  }, []);

  // A controlled input value change does not trigger a change event,
  // so we need to manually observe the value...
  useLayoutEffect(() => {
    if (sourceRef.current) {
      resize(sourceRef.current, sizingDivRef);
    }
  }, [options?.value]);

  const onInputChange = useCallback((_event: any) => {
    if (sourceRef.current) {
      resize(sourceRef.current, sizingDivRef);
    }
  }, []);

  const autosizingCallbackRef = useCallback(
    (element: HTMLInputElement | null) => {
      if (element) {
        resize(element, sizingDivRef);
        element.addEventListener('input', onInputChange);
      } else {
        sourceRef.current?.removeEventListener('input', onInputChange);
      }

      sourceRef.current = element;
    },
    [onInputChange]
  );

  return autosizingCallbackRef;
}

function resize(
  input: HTMLInputElement,
  sizingDivRef: React.MutableRefObject<HTMLDivElement | null>
) {
  const computedStyles = getComputedStyle(input);

  // Lazily create and attach the sizing div
  if (!sizingDivRef.current) {
    sizingDivRef.current = createSizingDiv(computedStyles);
    document.body.appendChild(sizingDivRef.current);
  }

  const sizingDiv = sizingDivRef.current;
  sizingDiv.innerText = input.value || input.placeholder;

  const newTotalInputSize =
    sizingDiv.offsetWidth +
    // parseInt is save here as the computed styles are always in px
    parseInt(computedStyles.paddingLeft ?? 0, 10) +
    parseInt(computedStyles.paddingRight ?? 0, 10) +
    parseInt(computedStyles.borderWidth ?? 0, 10) * 2 +
    1; // Add 1px to account for cursor width in Safari

  input.style.width = `${newTotalInputSize}px`;
}
