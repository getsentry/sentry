/*** @jsx React.DOM */

var BreadcrumbStore = require("../stores/breadcrumbStore");

var React = require("react");

module.exports = {
  /*
   * A mixin which should be used by components which want to append to the
   * breadcrumbs on a page.
   *
   * {
   *   mixins: [BreadcrumbMixin],
   *   // the number of crumbs you will manage
   *   crumbReservations: 1,
   *   // set the crumbs synchronously on mount, or async
   *   componentWillMount() {
   *     this.setBreadcrumbs([
   *       {name: data.name, to: 'teamDetails', params: {}}
   *     ]);
   *   }
   * }
   */

  contextTypes: {
    router: React.PropTypes.func.isRequired
  },

  goToRoute(node) {
    if (!node.to) return;
    return this.context.router.transitionTo(node.to, node.params, node.query);
  },

  breadcrumbFromNode(node) {
    if (typeof node.params === 'undefined') {
      node.params = this.context.router.getCurrentParams();
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
