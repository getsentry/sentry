import * as React from 'react';

import GlobalSelectionStore from 'sentry/stores/globalSelectionStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {GlobalSelection} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';

type InjectedGlobalSelectionProps = {
  selection?: GlobalSelection;
  isGlobalSelectionReady?: boolean;
};

/**
 * Higher order component that uses GlobalSelectionStore and provides the
 * active project
 */
function withGlobalSelection<P extends InjectedGlobalSelectionProps>(
  WrappedComponent: React.ComponentType<P>
) {
  type Props = Omit<P, keyof InjectedGlobalSelectionProps> & InjectedGlobalSelectionProps;

  const WithGlobalSelection: React.FC<Props> = props => {
    const {selection, isReady} = useLegacyStore(GlobalSelectionStore);

    const selectionProps = {
      selection,
      isGlobalSelectionReady: isReady,
    };

    return <WrappedComponent {...selectionProps} {...(props as P)} />;
  };

  const displayName = getDisplayName(WrappedComponent);
  WithGlobalSelection.displayName = `withGlobalSelection(${displayName})`;

  return WithGlobalSelection;
}

export default withGlobalSelection;
