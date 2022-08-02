import {useEffect, useRef} from 'react';
import {Location} from 'history';

type Options = {
  location: Location;
  /**
   * Function to stop scrolling from happening if a certan condition is met
   */
  disable?: (location: Location, prevLocation: Location) => boolean;
};

/**
 * Automatically scrolls to the top of the page any time the location changes.
 */
function useScrollToTop({location, disable}: Options) {
  const lastLocation = useRef(location);

  // Check if we should scroll to the top any time the location changes
  useEffect(() => {
    const shouldDisable = disable?.(location, lastLocation.current);
    lastLocation.current = location;

    if (shouldDisable) {
      return;
    }

    window.scrollTo(0, 0);
  }, [location, disable]);
}

export default useScrollToTop;
