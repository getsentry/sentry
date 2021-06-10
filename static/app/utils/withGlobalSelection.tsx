import * as React from 'react';

import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import {GlobalSelection} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';

type InjectedGlobalSelectionProps = {
  selection?: GlobalSelection;
  isGlobalSelectionReady?: boolean;
};

type State = {
  selection: GlobalSelection;
  isReady?: boolean;
};

/**
 * Higher order component that uses GlobalSelectionStore and provides the
 * active project
 */
function withGlobalSelection<P extends InjectedGlobalSelectionProps>(
  WrappedComponent: React.ComponentType<P>
) {
  class WithGlobalSelection extends React.Component<
    Omit<P, keyof InjectedGlobalSelectionProps> & Partial<InjectedGlobalSelectionProps>,
    State
  > {
    static displayName = `withGlobalSelection(${getDisplayName(WrappedComponent)})`;

    state = GlobalSelectionStore.get();

    componentWillUnmount() {
      this.unsubscribe();
    }

    unsubscribe = GlobalSelectionStore.listen((selection: State) => {
      if (this.state !== selection) {
        this.setState(selection);
      }
    }, undefined);

    render() {
      const {isReady, selection} = this.state;

      return (
        <WrappedComponent
          selection={selection as GlobalSelection}
          isGlobalSelectionReady={isReady}
          {...(this.props as P)}
        />
      );
    }
  }

  return WithGlobalSelection;
}

export default withGlobalSelection;
