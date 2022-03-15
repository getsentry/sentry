import {useEffect, useState} from 'react';

/**
 * Hook to detect when a specific key is being pressed
 */
function useKeyPress(targetKey: React.KeyboardEvent['key']): boolean {
  const [keyPressed, setKeyPressed] = useState(false);

  useEffect(() => {
    function downHandler({key}: KeyboardEvent) {
      if (key === targetKey) {
        setKeyPressed(true);
      }
    }

    function upHandler({key}: KeyboardEvent) {
      if (key === targetKey) {
        setKeyPressed(false);
      }
    }
    window.addEventListener('keydown', downHandler);
    window.addEventListener('keyup', upHandler);

    return () => {
      window.removeEventListener('keydown', downHandler);
      window.removeEventListener('keyup', upHandler);
    };
  }, [targetKey]);

  return keyPressed;
}

export default useKeyPress;
