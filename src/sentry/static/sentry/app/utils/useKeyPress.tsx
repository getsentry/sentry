// hook from https://usehooks.com/useKeyPress/
import {useEffect, useState} from 'react';

function useKeyPress(targetKey: React.KeyboardEvent['key']) {
  // State for keeping track of whether key is pressed
  const [keyPressed, setKeyPressed] = useState(false);

  // If pressed key is the target key then set to true
  function downHandler({key}) {
    if (key === targetKey) {
      setKeyPressed(true);
    }
  }

  // If released key is the target key then set to false
  function upHandler({key}) {
    if (key === targetKey) {
      setKeyPressed(false);
    }
  }

  // Add event listeners
  useEffect(() => {
    window.addEventListener('keydown', downHandler);
    window.addEventListener('keyup', upHandler);
    // Remove event listeners on cleanup
    return () => {
      window.removeEventListener('keydown', downHandler);
      window.removeEventListener('keyup', upHandler);
    };
  }, []); // Empty array ensures that effect is only run on mount and unmount

  return keyPressed;
}

export default useKeyPress;
