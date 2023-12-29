import {useRef} from 'react';
import identity from 'lodash/identity';

/**
 * Hook which returns a Date object which is only instantiated the first time
 * the hook is called.
 *
 * A modifier callback may be provided to have the date configured after it is
 * first initialized.
 */
export function useNow(modifier?: (now: Date) => Date) {
  const ref = useRef<Date>();

  if (ref.current === undefined) {
    const mutate = modifier ?? identity<Date>;
    const now = new Date();

    ref.current = mutate(now);
  }

  return ref.current;
}
