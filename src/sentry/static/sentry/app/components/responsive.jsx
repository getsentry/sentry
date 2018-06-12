import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import React from 'react';
import ReactResponsive from 'react-responsive';
import Reflux from 'reflux';

import PreferencesStore from 'app/stores/preferencesStore';
import theme from 'app/utils/theme';

class Responsive extends React.Component {
  static propTypes = {
    minWidth: PropTypes.number,
    maxWidth: PropTypes.number,
    sidebarCollapsed: PropTypes.bool,
    streamSidebarCollapsed: PropTypes.bool,
    useSidebar: PropTypes.bool,
    useStreamSidebar: PropTypes.bool,
  };

  render() {
    let {
      minWidth,
      maxWidth,
      useSidebar,
      useStreamSidebar,
      sidebarCollapsed,
      streamSidebarCollapsed,
      ...props
    } = this.props;

    // support min/max widths only
    if (useSidebar) {
      let sidebarWidth = sidebarCollapsed
        ? theme.sidebar.collapsedInt
        : theme.sidebar.expandedInt;
      minWidth = typeof minWidth !== 'undefined' ? minWidth + sidebarWidth : minWidth;
      maxWidth = typeof maxWidth !== 'undefined' ? maxWidth + sidebarWidth : maxWidth;
    }

    if (useStreamSidebar) {
      let streamSidebarWidth = streamSidebarCollapsed ? 1 : 1.25;
      minWidth =
        typeof minWidth !== 'undefined'
          ? Math.round(minWidth * streamSidebarWidth)
          : minWidth;
      maxWidth =
        typeof maxWidth !== 'undefined'
          ? Math.round(maxWidth * streamSidebarWidth)
          : maxWidth;
    }

    return <ReactResponsive {...props} minWidth={minWidth} maxWidth={maxWidth} />;
  }
}

const ResponsiveContainer = createReactClass({
  displayName: 'SidebarContainer',
  mixins: [Reflux.listenTo(PreferencesStore, 'onPreferenceChange')],
  getInitialState() {
    return {
      collapsed: PreferencesStore.getInitialState().collapsed,
    };
  },

  onPreferenceChange(store) {
    if (store.collapsed === this.state.collapsed) return;

    this.setState({
      collapsed: store.collapsed,
    });
  },

  render() {
    return <Responsive {...this.props} sidebarCollapsed={this.state.collapsed} />;
  },
});

export default ResponsiveContainer;
export {Responsive};
