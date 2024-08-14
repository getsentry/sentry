import {useEffect, useState} from 'react';

/**
 * Hook to detect when a specific key is being pressed
 */
const useKeyPress = (
  targetKey: string,
  target?: HTMLElement,
  captureAndStop: boolean = false
) => {
  const [keyPressed, setKeyPressed] = useState(false);
  const current = target ?? document.body;

  useEffect(() => {
    const downHandler = (event: KeyboardEvent) => {
      if (event.key === targetKey) {
        setKeyPressed(true);
        if (captureAndStop) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    };

    const upHandler = (event: KeyboardEvent) => {
      if (event.key === targetKey) {
        setKeyPressed(false);
        if (captureAndStop) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    };

    current.addEventListener('keydown', downHandler, captureAndStop);
    current.addEventListener('keyup', upHandler, captureAndStop);

    return () => {
      current.removeEventListener('keydown', downHandler, captureAndStop);
      current.removeEventListener('keyup', upHandler, captureAndStop);
    };
  }, [targetKey, current, captureAndStop]);

  return keyPressed;
};

export default useKeyPress;
