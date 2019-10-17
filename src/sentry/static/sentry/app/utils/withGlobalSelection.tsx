import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import getDisplayName from 'app/utils/getDisplayName';
import {GlobalSelection} from 'app/types';

type InjectedGlobalSelectionProps = {
  forceUrlSync?: boolean;
  selection: GlobalSelection;
};

type State = {
  selection: GlobalSelection;
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
      return {
        selection: GlobalSelectionStore.get(),
      };
    },

    componentDidMount() {
      this.updateSelection();
    },

    onUpdate() {
      this.updateSelection();
    },

    updateSelection() {
      const selection = GlobalSelectionStore.get();

      if (this.state.selection !== selection) {
        this.setState({selection});
      }
    },

    render() {
      const {forceUrlSync, ...selection} = this.state.selection;
      return (
        <WrappedComponent
          forceUrlSync={!!forceUrlSync}
          selection={selection as GlobalSelection}
          {...this.props as P}
        />
      );
    },
  });

export default withGlobalSelection;
