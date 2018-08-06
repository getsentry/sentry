import React from 'react';
import DocumentTitle from 'react-document-title';

import sdk from 'app/utils/sdk';
import Footer from 'app/components/footer';
import Sidebar from 'app/components/sidebar';
import NotFound from 'app/components/errors/notFound';

class RouteNotFound extends React.Component {
  componentDidMount() {
    sdk.captureException(new Error('Route not found'), {
      fingerprint: ['RouteNotFound'],
    });
  }

  getTitle = () => {
    return 'Page Not Found';
  };

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
}

export default RouteNotFound;
