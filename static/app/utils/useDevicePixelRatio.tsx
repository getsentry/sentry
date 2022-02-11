import * as React from 'react';

/**
 * Hook to retrieve dpr value of the device and monitor for changes
 * (e.g. if user drags window to a screen with different dpr, we want to be notified).
 * @returns dpr of the device
 */
function useDevicePixelRatio(): number {
  const [devicePixelRatio, setDevicePixelRatio] = React.useState<number>(
    window.devicePixelRatio
  );

  const updatePixelRatio = React.useCallback(() => {
    setDevicePixelRatio(window.devicePixelRatio);
  }, []);

  React.useLayoutEffect(() => {
    window
      .matchMedia(`(resolution: ${devicePixelRatio}dppx)`)
      .addEventListener('change', updatePixelRatio, {once: true});

    return () => {
      window
        .matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
        .removeEventListener('change', updatePixelRatio);
    };
  }, [devicePixelRatio]);

  return devicePixelRatio;
}

export {useDevicePixelRatio};
