import {useEffect, useState} from 'react';
import screenfull from 'screenfull';

/**
 * Returns true of _any_ dom node is fullscreen right now.
 *
 * This hook converts `screenfull.isFullscreen` into a stateful value you can use
 * as part of your component render method.
 */
export default function useIsFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(screenfull.isFullscreen);

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
