import React from "react";
import DocumentTitle from "react-document-title";
import Footer from "../components/footer";
import Header from "../components/header";

var RouteNotFound = React.createClass({
  statics: {
    // Try and append a trailing slash to the route when we "404".
    //
    // Reference:
    //   https://github.com/rackt/react-router/blob/0.13.x/examples/auth-flow/app.js#L46-L50
    //
    // NOTE: This behavior changes in react-router 1.0:
    //   https://github.com/rackt/react-router/blob/v1.0.0-rc1/UPGRADE_GUIDE.md#willtransitionto-and-willtransitionfrom
    willTransitionTo(transition) {
      let path = transition.path;
      if (path.charAt(path.length - 1) !== '/') {
        transition.redirect(path + '/');
      }
    }
  },

  getTitle() {
    return 'Page Not Found';
  },

  render() {
    // TODO(dcramer): show additional resource links
    return (
      <DocumentTitle title={this.getTitle()}>
        <div className="app">
          <Header />
          <div className="container">
            <div className="content">
              <section className="body">
                <div className="page-header">
                  <h2>Page Not Found</h2>
                </div>
                <p className="alert-message notice">The page you are looking for was not found.</p>
              </section>
            </div>
          </div>
          <Footer />
        </div>
      </DocumentTitle>
    );
  }
});

export default RouteNotFound;

