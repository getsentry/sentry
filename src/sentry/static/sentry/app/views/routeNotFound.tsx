import React from 'react';
import DocumentTitle from 'react-document-title';
import {Location} from 'history';
import * as Sentry from '@sentry/react';

import Footer from 'app/components/footer';
import Sidebar from 'app/components/sidebar';
import NotFound from 'app/components/errors/notFound';

type Props = {
  location: Location;
};

class RouteNotFound extends React.Component<Props> {
  componentDidMount() {
    Sentry.withScope(scope => {
      scope.setFingerprint(['RouteNotFound']);
      Sentry.captureException(new Error('Route not found'));
    });
  }

  getTitle = () => 'Page Not Found';

  render() {
    // TODO(dcramer): show additional resource links
    return (
      <DocumentTitle title={this.getTitle()}>
        <div className="app">
          <Sidebar location={this.props.location} />
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
