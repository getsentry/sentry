/*** @jsx React.DOM */

var BreadcrumbStore = require("../stores/breadcrumbStore");

module.exports = {

  componentWillMount() {
    this.crumbs = this.getInitialBreadcrumbs();
  },

  componentDidMount() {
    this.crumbs.forEach((node) => {
      BreadcrumbStore.push(node);
    });
  },

  componentWillUnmount() {
    this.crumbs.forEach(() => {
      BreadcrumbStore.pop();
    });
  },

  setBreadcrumbs(nodes) {
    this.componentWillUnmount();
    this.crumbs = nodes;
    this.crumbs.forEach((node) => {
      BreadcrumbStore.push(node);
    });
  },

  getInitialBreadcrumbs() {
    return [];
  }
};
