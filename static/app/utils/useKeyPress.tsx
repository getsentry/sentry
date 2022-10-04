import {useEffect, useState} from 'react';

/**
 * Hook to detect when a specific key is being pressed
 */
const useKeyPress = (targetKey: string, target?: HTMLElement) => {
  const [keyPressed, setKeyPressed] = useState(false);
  const current = target ?? document.body;

  useEffect(() => {
    const downHandler = ({key}: KeyboardEvent) => {
      if (key === targetKey) {
        setKeyPressed(true);
      }
    };

    const upHandler = ({key}: KeyboardEvent) => {
      if (key === targetKey) {
        setKeyPressed(false);
      }
    };

    current.addEventListener('keydown', downHandler);
    current.addEventListener('keyup', upHandler);

    return () => {
      current.removeEventListener('keydown', downHandler);
      current.removeEventListener('keyup', upHandler);
    };
  }, [targetKey, current]);

  return keyPressed;
};

export default useKeyPress;
