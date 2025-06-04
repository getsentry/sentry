import {useCallback, useLayoutEffect, useState} from 'react';

/**
 * Hook to retrieve dpr value of the device and monitor for changes
 * (e.g. if user drags window to a screen with different dpr, we want to be notified).
 * @returns dpr of the device
 */
function useDevicePixelRatio(): number {
  const [devicePixelRatio, setDevicePixelRatio] = useState<number>(
    window.devicePixelRatio
  );

  const updateDevicePixelRatio = useCallback(() => {
    setDevicePixelRatio(window.devicePixelRatio);
  }, []);

  useLayoutEffect(() => {
    window
      .matchMedia(`(resolution: ${devicePixelRatio}dppx)`)
      .addEventListener('change', updateDevicePixelRatio, {once: true});

    return () => {
      window
        .matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
        .removeEventListener('change', updateDevicePixelRatio);
    };
  }, [devicePixelRatio, updateDevicePixelRatio]);

  return devicePixelRatio;
}

export {useDevicePixelRatio};
