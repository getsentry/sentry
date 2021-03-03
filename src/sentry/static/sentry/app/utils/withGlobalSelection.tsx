import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

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
