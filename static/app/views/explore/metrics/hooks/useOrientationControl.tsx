import {useState} from 'react';

import {useBreakpoints} from 'sentry/utils/useBreakpoints';

export type TableOrientation = 'right' | 'bottom';

export function useTableOrientationControl(): {
  canChangeOrientation: boolean;
  orientation: TableOrientation;
  setOrientation: (orientation: TableOrientation) => void;
  userPreferenceOrientation: TableOrientation;
} {
  const breakpoints = useBreakpoints();
  const [userPreference, setUserPreference] = useState<TableOrientation>('right');

  // Derive the actual orientation based on screen size
  const effectiveOrientation = breakpoints.md ? userPreference : 'bottom';
  const canChangeOrientation = breakpoints.md;

  return {
    orientation: effectiveOrientation,
    userPreferenceOrientation: userPreference,
    setOrientation: setUserPreference,
    canChangeOrientation,
  };
}
