import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import getDisplayName from 'app/utils/getDisplayName';

/**
 * Higher order component that uses GlobalSelectionStore and provides the
 * active project
 */
const withGlobalSelection = WrappedComponent =>
  createReactClass({
    displayName: `withGlobalSelection(${getDisplayName(WrappedComponent)})`,
    propTypes: {
      // Does not initially load values from the store
      // However any following updates to store should work
      disableLoadFromStore: PropTypes.bool,
    },
    mixins: [Reflux.listenTo(GlobalSelectionStore, 'onUpdate')],
    getInitialState() {
      return {
        selection: this.props.disableLoadFromStore
          ? {projects: [], environments: [], datetime: {}}
          : GlobalSelectionStore.get(),
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
