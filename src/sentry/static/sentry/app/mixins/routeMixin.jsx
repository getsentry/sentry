/*** @jsx React.DOM */

var RouteMixin = {
  getInitialState() {
    return {
      activeRoutePath: this.getPath(),
      activeParams: this.getParams(),
      activeQuery: this.getQuery()
    };
  },

  componentWillReceiveProps(nextProps) {
    if (this.state.activeRoutePath != this.getPath()) {
      this.routeDidChange(
        this.state.activeRoutePath,
        this.state.activeParams,
        this.state.activeQuery);
      this.setState({
        activeRoutePath: this.getPath(),
        activeParams: this.getParams(),
        activeQuery: this.getQuery()
      });
    }
  },
};

module.exports = RouteMixin;
