import type {PageFilters} from 'sentry/types/core';
import getDisplayName from 'sentry/utils/getDisplayName';

import usePageFilters from './usePageFilters';

type InjectedPageFiltersProps = {
  isGlobalSelectionReady?: boolean;
  selection?: PageFilters;
};

/**
 * Higher order component that uses PageFiltersStore and provides the active
 * project
 */
function withPageFilters<P extends InjectedPageFiltersProps>(
  WrappedComponent: React.ComponentType<P>
) {
  type Props = Omit<P, keyof InjectedPageFiltersProps> & InjectedPageFiltersProps;

  function WithPageFilters(props: Props) {
    const {selection, isReady: isGlobalSelectionReady} = usePageFilters();

    const selectionProps = {
      selection,
      isGlobalSelectionReady,
    };

    // TODO(any): HoC prop types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261
    return <WrappedComponent {...selectionProps} {...(props as P as any)} />;
  }

  const displayName = getDisplayName(WrappedComponent);
  WithPageFilters.displayName = `withPageFilters(${displayName})`;

  return WithPageFilters;
}

export default withPageFilters;
