/*** @jsx React.DOM */

var PropTypes = require("../proptypes");

var RouteMixin = {
  getInitialState() {
    return {
      activeRoutePath: this.getPath()
    };
  },

  componentWillReceiveProps(nextProps) {
    if (this.state.activeRoutePath != this.getPath()) {
      this.routeDidChange(this.state.activeRoutePath);
      this.setState({activeRoutePath: this.getPath()});
    }
  },
};

module.exports = RouteMixin;
