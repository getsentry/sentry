var React = require("react");
var Reflux = require("reflux");

var BreadcrumbStore = require('../stores/breadcrumbStore');

var Breadcrumbs = React.createClass({
  mixins: [
    Reflux.listenTo(BreadcrumbStore, "onBreadcrumbChange", "onBreadcrumbChange")
  ],

  contextTypes: {
    router: React.PropTypes.func.isRequired
  },

  getInitialState() {
    return {
      nodes: BreadcrumbStore.getNodes()
    };
  },

  onBreadcrumbChange() {
    this.setState({
      nodes: BreadcrumbStore.getNodes()
    });
  },

  render() {
    var children = this.state.nodes.map((node, _) => {
      return (
        <li key={'bc-' + _}>
          {node}
        </li>
      );
    });

    return (
      <ul className="breadcrumb">
        {children}
      </ul>
    );
  }
});


module.exports = Breadcrumbs;
