import {useEffect, useState} from 'react';

/**
 * Hook to detect when a specific key is being pressed
 */
const useKeyPress = (
  targetKey: string,
  targetRef?: React.RefObject<HTMLInputElement>
) => {
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

    const current: any = targetRef?.current ?? window;
    current?.addEventListener('keydown', downHandler);
    current?.addEventListener('keyup', upHandler);

    return () => {
      current?.removeEventListener('keydown', downHandler);
      current?.removeEventListener('keyup', upHandler);
    };
  }, [targetKey, targetRef]);

  return keyPressed;
};

export default useKeyPress;
