import {RefObject, useEffect, useState} from 'react';

/**
 * Hook to detect when a specific key is being pressed
 */
const useKeyPress = (targetKey: string, ref?: RefObject<HTMLElement>) => {
  const [keyPressed, setKeyPressed] = useState(false);
  const target = ref ? ref.current : document.body;

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

    target?.addEventListener('keydown', downHandler);
    target?.addEventListener('keyup', upHandler);

    return () => {
      target?.removeEventListener('keydown', downHandler);
      target?.removeEventListener('keyup', upHandler);
    };
  }, [targetKey, target]);

  return keyPressed;
};

export default useKeyPress;
