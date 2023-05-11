import {PageFilters} from 'sentry/types';
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

    return <WrappedComponent {...selectionProps} {...(props as P)} />;
  }

  const displayName = getDisplayName(WrappedComponent);
  WithPageFilters.displayName = `withPageFilters(${displayName})`;

  return WithPageFilters;
}

export default withPageFilters;
