import {useCallback, useEffect, useRef, useState} from 'react';
import screenfull from 'screenfull';

// TODO: move into app/utils/*
// TODO: currently 'isFullscreen' is not scoped to the ref, so if _anything_ is
// fullscreen, then _everything_ watching will believe that it is fullscreen.
export default function useFullscreen() {
  const ref = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const enter = useCallback(async () => {
    if (screenfull.isEnabled && ref.current) {
      await screenfull.request(ref.current);
    }
  }, [ref.current]);

  const exit = async () => {
    if (screenfull.isEnabled) {
      await screenfull.exit();
    }
  };

  const onChange = () => {
    setIsFullscreen(screenfull.isFullscreen);
  };

  useEffect(() => {
    screenfull.on('change', onChange);
    return () => screenfull.off('change', onChange);
  });

  return {
    isEnabled: screenfull.isEnabled,
    ref,
    isFullscreen,
    enter,
    exit,
  };
}
