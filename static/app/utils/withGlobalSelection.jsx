import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import getDisplayName from 'app/utils/getDisplayName';
import GlobalSelectionStore from 'app/stores/globalSelectionStore';

/**
 * Higher order component that uses GlobalSelectionStore and provides the
 * active project
 */
const withGlobalSelection = WrappedComponent =>
  createReactClass({
    displayName: `withGlobalSelection(${getDisplayName(WrappedComponent)})`,
    mixins: [Reflux.listenTo(GlobalSelectionStore, 'onUpdate')],
    getInitialState() {
      return {
        selection: GlobalSelectionStore.get(),
      };
    },

    onUpdate() {
      this.setState({
        selection: GlobalSelectionStore.get(),
      });
    },
    render() {
      return <WrappedComponent selection={this.state.selection} {...this.props} />;
    },
  });

export default withGlobalSelection;
