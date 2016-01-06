import React from 'react';
import DocumentTitle from 'react-document-title';
import Footer from '../components/footer';
import Header from '../components/header';
import {t} from '../locale';

const RouteNotFound = React.createClass({
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
                <div className="alert alert-block alert-error">
                  <div style={{fontSize: 24, marginBottom: 10}}>
                    <span className="icon-exclamation" style={{fontSize: 20, marginRight: 10}} />
                    <span>{t('Page Not Found')}</span>
                  </div>

                  <p>The page you are looking for was not found.</p>
                  <p>You may wish to try the following:</p>
                  <ul>
                      <li>If you entered the address manually, double check the path. Did you forget a trailing slash?</li>
                      <li>If you followed a link here, try hitting back and reloading the page. It's possible the resource was moved out from under you.</li>
                      <li>If all else fails, <a href="http://github.com/getsentry/sentry/issues">create an issue</a> with more details.</li>
                  </ul>
                  <p>Not sure what to do? <a href="/">Return to the dashboard</a></p>
                </div>
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

