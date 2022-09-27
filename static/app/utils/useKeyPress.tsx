import {useEffect, useState} from 'react';

/**
 * Hook to detect when a specific key is being pressed
 */
const useKeyPress = (targetKey: string, targetRef?: React.RefObject<HTMLElement>) => {
  const [keyPressed, setKeyPressed] = useState(false);

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

    const current = targetRef?.current ?? window;
    (current as HTMLElement)?.addEventListener('keydown', downHandler);
    (current as HTMLElement)?.addEventListener('keyup', upHandler);

    return () => {
      (current as HTMLElement)?.removeEventListener('keydown', downHandler);
      (current as HTMLElement)?.removeEventListener('keyup', upHandler);
    };
  }, [targetKey, targetRef]);

  return keyPressed;
};

export default useKeyPress;
