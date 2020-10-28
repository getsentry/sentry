import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import getDisplayName from 'app/utils/getDisplayName';
import {GlobalSelection} from 'app/types';

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
const withGlobalSelection = <P extends InjectedGlobalSelectionProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  createReactClass<
    Omit<P, keyof InjectedGlobalSelectionProps> & Partial<InjectedGlobalSelectionProps>,
    State
  >({
    displayName: `withGlobalSelection(${getDisplayName(WrappedComponent)})`,
    mixins: [Reflux.listenTo(GlobalSelectionStore, 'onUpdate') as any],

    getInitialState() {
      return GlobalSelectionStore.get();
    },

    onUpdate(selection: State) {
      if (this.state !== selection) {
        this.setState(selection);
      }
    },

    render() {
      const {isReady, selection} = this.state;

      return (
        <WrappedComponent
          selection={selection as GlobalSelection}
          isGlobalSelectionReady={isReady}
          {...(this.props as P)}
        />
      );
    },
  });

export default withGlobalSelection;
