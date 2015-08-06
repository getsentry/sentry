import React from "react";
import DocumentTitle from "react-document-title";
import Footer from "../components/footer";
import Header from "../components/header";

var RouteNotFound = React.createClass({
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

