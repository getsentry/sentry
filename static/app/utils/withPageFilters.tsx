import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {PageFilters} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';

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

  const WithPageFilters: React.FC<Props> = props => {
    const {selection, isReady} = useLegacyStore(PageFiltersStore);

    const selectionProps = {
      selection,
      isGlobalSelectionReady: isReady,
    };

    return <WrappedComponent {...selectionProps} {...(props as P)} />;
  };

  const displayName = getDisplayName(WrappedComponent);
  WithPageFilters.displayName = `withPageFilters(${displayName})`;

  return WithPageFilters;
}

export default withPageFilters;
