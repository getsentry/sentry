import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import getDisplayName from 'app/utils/getDisplayName';
import {GlobalSelection} from 'app/types';

/**
 * Higher order component that uses GlobalSelectionStore and provides the
 * active project
 */
const withGlobalSelection = <P extends object>(
  WrappedComponent: React.ComponentType<P>
) =>
  createReactClass({
    displayName: `withGlobalSelection(${getDisplayName(WrappedComponent)})`,
    mixins: [Reflux.listenTo(GlobalSelectionStore, 'onUpdate')],
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
        this.setState({
          selection,
        });
      }
    },

    render() {
      const {forceUrlSync, ...selection} = this.state.selection;
      return (
        <WrappedComponent
          forceUrlSync={forceUrlSync as boolean}
          selection={selection as GlobalSelection}
          {...this.props as P}
        />
      );
    },
  });

export default withGlobalSelection;
