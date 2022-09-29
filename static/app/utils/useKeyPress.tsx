import {useEffect, useState} from 'react';

/**
 * Hook to detect when a specific key is being pressed
 */
const useKeyPress = (
  targetKey: string,
  targetRef?: React.RefObject<HTMLElement> | HTMLElement
) => {
  const [keyPressed, setKeyPressed] = useState(false);
  let current = document.body;
  if (targetRef) {
    current = ('current' in targetRef ? targetRef.current : targetRef) as HTMLElement;
  }

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
