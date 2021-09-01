import {useCallback, useEffect, useState} from 'react';

function useKeyPress(targetKey: React.KeyboardEvent['key']) {
  const [keyPressed, setKeyPressed] = useState(false);

  // If pressed key is the target key then set to true
  const downHandler = useCallback<(ev: KeyboardEvent) => void>(
    ({key}) => key === targetKey && setKeyPressed(true),
    [targetKey]
  );

  // If released key is the target key then set to false
  const upHandler = useCallback<(ev: KeyboardEvent) => void>(
    ({key}) => key === targetKey && setKeyPressed(false),
    [targetKey]
  );

  useEffect(() => {
    window.addEventListener('keydown', downHandler);
    window.addEventListener('keyup', upHandler);

    return () => {
      window.removeEventListener('keydown', downHandler);
      window.removeEventListener('keyup', upHandler);
    };
  }, []);

  return keyPressed;
}

export default useKeyPress;
