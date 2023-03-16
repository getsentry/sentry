import {MutableRefObject, useCallback, useEffect, useRef, useState} from 'react';
import screenfull from 'screenfull';

// See: https://developer.mozilla.org/en-US/docs/web/api/element/requestfullscreen#options_2
interface FullscreenOptions {
  navigationUI: 'hide' | 'show' | 'auto';
}

interface FullscreenHook {
  /**
   * Render, in fullscreen, the `ref` that this instance relates to. If `ref`
   * is unset, then `<html>` will be used.
   */
  enter: (options?: FullscreenOptions) => void;

  /**
   * Bring the browser out of fullscreen, regardless of which DOM element is
   * currently active.
   */
  exit: () => void;

  /**
   * If the browser supports going fullscreen or not. iPhone Safari won't do
   * it. https://caniuse.com/fullscreen
   */
  isEnabled: boolean;

  /**
   * Whether any element on the page is rendered fullscreen.
   */
  isFullscreen: boolean;

  /**
   * The element that this instance of `enter()` will use to go fullscreen.
   * Calling `useFullscreen()` a second time will create a different instance of
   * `ref` and `enter.
   */
  ref: MutableRefObject<null | HTMLDivElement>;

  /**
   * Toggle fullscreen mode on and off, for the `ref` that this instance
   * relates to.
   */
  toggle: () => void;
}

// TODO(replay): move into app/utils/*
export default function useFullscreen(): FullscreenHook {
  const ref = useRef<null | HTMLDivElement>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const enter = useCallback(async (opts: FullscreenOptions = {navigationUI: 'auto'}) => {
    if (screenfull.isEnabled && ref.current) {
      await screenfull.request(ref.current, opts);
    }
  }, []);

  const exit = useCallback(async () => {
    if (screenfull.isEnabled) {
      await screenfull.exit();
    }
  }, []);

  const toggle = useCallback(
    () => (isFullscreen ? exit() : enter()),
    [enter, exit, isFullscreen]
  );

  useEffect(() => {
    if (screenfull.isEnabled) {
      const onChange = () => {
        setIsFullscreen(screenfull.isFullscreen);
      };

      screenfull.on('change', onChange);
      return () => screenfull.off('change', onChange);
    }
    return () => {};
  }, []);

  return {
    enter,
    exit,
    isEnabled: screenfull.isEnabled,
    isFullscreen,
    ref,
    toggle,
  };
}
