var React = require("react");

var DocumentTitle = require("react-document-title");
var Footer = require("../components/footer");
var Header = require("../components/header");

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

module.exports = RouteNotFound;
