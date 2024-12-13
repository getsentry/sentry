import {useCallback, useState} from 'react';

import type {BreadcrumbControlOptions} from 'sentry/components/events/breadcrumbs/breadcrumbsDrawer';
import type {FlagControlOptions} from 'sentry/components/events/featureFlags/utils';

type FocusControlOption = BreadcrumbControlOptions | FlagControlOptions;

export default function useFocusControl(initialFocusControl?: FocusControlOption) {
  const [focusControl, setFocusControl] = useState(initialFocusControl);
  // If the focused control element is blurred, unset the state to remove styles
  // This will allow us to simulate :focus-visible on the button elements.
  const getFocusProps = useCallback(
    (option: FocusControlOption) => {
      return option === focusControl
        ? {autoFocus: true, onBlur: () => setFocusControl(undefined)}
        : {};
    },
    [focusControl]
  );
  return {getFocusProps};
}
