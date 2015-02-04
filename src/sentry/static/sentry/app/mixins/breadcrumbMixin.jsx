/*** @jsx React.DOM */

var BreadcrumbStore = require("../stores/breadcrumbStore");

module.exports = {
  componentWillMount() {
    this.crumbs = this.getBreadcrumbNodes();
    this.crumbs.forEach((node) => {
      BreadcrumbStore.push(node);
    });
  },

  componentWillUnmount() {
    this.crumbs.forEach(() => {
      BreadcrumbStore.pop();
    });
  }
};
