import {useEffect, useState} from 'react';
import screenfull from 'screenfull';

export default function useIsFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!screenfull.isEnabled) {
      return () => {};
    }

    const onChange = () => {
      setIsFullscreen(!isFullscreen);
    };
    screenfull.on('change', onChange);
    return () => screenfull.off('change', onChange);
  }, [isFullscreen]);

  return isFullscreen;
}
