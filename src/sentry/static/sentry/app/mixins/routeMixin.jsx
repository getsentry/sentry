/*** @jsx React.DOM */

var PropTypes = require("../proptypes");

var RouteMixin = {
  getInitialState() {
    return {
      activeRoutePath: this.getPath()
    };
  },

  componentWillReceiveProps(nextProps) {
    if (this.state.routePath != this.getPath()) {
      this.routeDidChange(this.state.routePath);
      this.setState({routePath: this.getPath()});
    }
  },
};

module.exports = RouteMixin;
