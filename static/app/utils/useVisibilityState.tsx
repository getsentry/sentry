import {useCallback, useEffect, useState} from 'react';

function useVisibilityState() {
  const [visibilityState, setVisibilityState] = useState<VisibilityState | null>(null);

  const handleVisbilityChange = useCallback(() => {
    setVisibilityState(document.visibilityState);
  }, [setVisibilityState]);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisbilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisbilityChange);
  }, [handleVisbilityChange]);

  return visibilityState;
}

export default useVisibilityState;
