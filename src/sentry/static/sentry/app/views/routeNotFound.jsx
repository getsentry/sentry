import React from 'react';
import DocumentTitle from 'react-document-title';
import Footer from '../components/footer';
import Sidebar from '../components/sidebar';
import NotFound from '../components/errors/notFound';

const RouteNotFound = React.createClass({
  getTitle() {
    return 'Page Not Found';
  },

  render() {
    // TODO(dcramer): show additional resource links
    return (
      <DocumentTitle title={this.getTitle()}>
        <div className="app">
          <Sidebar />
          <div className="container">
            <div className="content">
              <section className="body">
                <NotFound />
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
