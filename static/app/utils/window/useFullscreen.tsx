import {RefObject, useCallback} from 'react';
import screenfull from 'screenfull';

interface Props<Element extends HTMLElement> {
  /**
   * The element that this instance of `enter()` will use to go fullscreen.
   * Calling `useFullscreen()` a second time will create a different instance of
   * `ref` and `enter.
   */
  elementRef: RefObject<Element>;
}

interface Return {
  /**
   * Render, in fullscreen, the `ref` that this instance relates to. If `ref`
   * is unset, then `<html>` will be used.
   *
   * FullscreenOptions: https://developer.mozilla.org/en-US/docs/web/api/element/requestfullscreen#options_2
   */
  enter: (options?: FullscreenOptions) => void;

  /**
   * Bring the browser out of fullscreen, regardless of which DOM element is
   * currently active.
   */
  exit: () => void;

  /**
   * Toggle fullscreen mode on and off, for the `ref` that this instance
   * relates to.
   */
  toggle: () => void;
}

/**
 * Enable/Disable/Toggle fullscreen mode for a specified element.
 */
export default function useFullscreen<Element extends HTMLElement>({
  elementRef,
}: Props<Element>): Return {
  const enter = useCallback(
    async (opts: FullscreenOptions = {navigationUI: 'auto'}) => {
      if (screenfull.isEnabled && elementRef.current) {
        await screenfull.request(elementRef.current, opts);
      }
    },
    [elementRef]
  );

  const exit = useCallback(async () => {
    if (screenfull.isEnabled) {
      await screenfull.exit();
    }
  }, []);

  const toggle = useCallback(
    () => (screenfull.isFullscreen ? exit() : enter()),
    [enter, exit]
  );

  return {
    enter,
    exit,
    toggle,
  };
}
