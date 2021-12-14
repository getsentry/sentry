import {useEffect, useRef} from 'react';
import {Location} from 'history';

type Props = {
  location: Location;
  disable: (location: Location, prevLocation: Location) => boolean;
};

function ScrollToTop({location, disable}: Props) {
  const lastLocation = useRef(location);

  // Check if we should scroll to the top any time the location changes
  useEffect(() => {
    const shouldDisable = disable?.(location, lastLocation.current);
    lastLocation.current = location;

    if (shouldDisable) {
      return;
    }

    window.scrollTo(0, 0);
  }, [location]);

  return null;
}

export default ScrollToTop;
