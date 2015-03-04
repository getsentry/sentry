/*** @jsx React.DOM */

var BreadcrumbStore = require("../stores/breadcrumbStore");

var React = require("react");

module.exports = {
  // Require both Router.State and Router.Navigation contexts
  // We do this to avoid potentially duplicating mixins
  contextTypes: {
    // Router.State
    getCurrentPath: React.PropTypes.func.isRequired,
    getCurrentRoutes: React.PropTypes.func.isRequired,
    getCurrentPathname: React.PropTypes.func.isRequired,
    getCurrentParams: React.PropTypes.func.isRequired,
    getCurrentQuery: React.PropTypes.func.isRequired,
    isActive: React.PropTypes.func.isRequired,

    // Router.Navigation
    makePath: React.PropTypes.func.isRequired,
    makeHref: React.PropTypes.func.isRequired,
    transitionTo: React.PropTypes.func.isRequired,
    replaceWith: React.PropTypes.func.isRequired,
    goBack: React.PropTypes.func.isRequired
  },

  goToRoute(node) {
    return this.context.transitionTo(node.to, node.params, node.query);
  },

  breadcrumbFromNode(node) {
    if (typeof node.params === 'undefined') {
      node.params = this.context.getCurrentParams();
    }

    return (
      <a onClick={this.goToRoute.bind(this, node)}>
        {node.name}
      </a>
    );
  },

  componentWillMount() {
    this.crumbs = [];
    for (var i = 0; i < (this.crumbReservations || 0); i++) {
      this.crumbs.push(BreadcrumbStore.reserve());
    }
  },

  componentWillUnmount() {
    this.crumbs.forEach((idx) => {
      BreadcrumbStore.pop(idx);
    });
  },

  setBreadcrumbs(nodes) {
    if (this.crumbs.length !== nodes.length) {
      throw new Error('You must reserve crumbs before setting them.');
    }
    nodes.forEach((node, nodeIdx) => {
      BreadcrumbStore.update(
        this.crumbs[nodeIdx],
        this.breadcrumbFromNode(node)
      );
    });
  }
};
