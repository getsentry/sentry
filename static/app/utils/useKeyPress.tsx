import {useEffect, useState} from 'react';

/**
 * Hook to detect when a specific key is being pressed
 */
const useKeyPress = (
  targetKey: string,
  target?: HTMLElement,
  preventDefault?: boolean
) => {
  const [keyPressed, setKeyPressed] = useState(false);
  const current = target ?? document.body;

  useEffect(() => {
    const downHandler = (event: KeyboardEvent) => {
      if (event.key === targetKey) {
        setKeyPressed(true);
        if (preventDefault) {
          event.preventDefault();
        }
      }
    };

    const upHandler = (event: KeyboardEvent) => {
      if (event.key === targetKey) {
        setKeyPressed(false);
        if (preventDefault) {
          event.preventDefault();
        }
      }
    };

    current.addEventListener('keydown', downHandler);
    current.addEventListener('keyup', upHandler);

    return () => {
      current.removeEventListener('keydown', downHandler);
      current.removeEventListener('keyup', upHandler);
    };
  }, [targetKey, current, preventDefault]);

  return keyPressed;
};

export default useKeyPress;
