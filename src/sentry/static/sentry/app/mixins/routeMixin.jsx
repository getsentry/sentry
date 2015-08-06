import React from "react";

var RouteMixin = {
  contextTypes: {
    router: React.PropTypes.func
  },

  getInitialState() {
    var router = this.context.router;
    return {
      activeRoutePath: router.getCurrentPath(),
      activeParams: router.getCurrentParams(),
      activeQuery: router.getCurrentQuery()
    };
  },

  componentWillReceiveProps(nextProps) {
    var router = this.context.router;
    if (this.state.activeRoutePath != router.getCurrentPath()) {
      this.routeDidChange(
        this.state.activeRoutePath,
        this.state.activeParams,
        this.state.activeQuery);
      this.setState({
        activeRoutePath: router.getCurrentPath(),
        activeParams: router.getCurrentParams(),
        activeQuery: router.getCurrentQuery()
      });
    }
  },
};

export default RouteMixin;

