import {RefObject, useEffect, useState} from 'react';

/**
 * Hook to detect when a specific key is being pressed
 */
const useKeyPress = function (targetKey: string, ref?: RefObject<HTMLInputElement>) {
  const [keyPressed, setKeyPressed] = useState(false);

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

  useEffect(() => {
    const current = ref?.current || window;
    // @ts-ignore
    current?.addEventListener('keydown', downHandler);
    // @ts-ignore
    current?.addEventListener('keyup', upHandler);

    return () => {
      // @ts-ignore
      current?.removeEventListener('keydown', downHandler);
      // @ts-ignore
      current?.removeEventListener('keyup', upHandler);
    };
  });

  return keyPressed;
};

export default useKeyPress;
