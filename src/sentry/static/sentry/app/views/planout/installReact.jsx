import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import {t} from 'app/locale';

const InstallReactTest = createReactClass({
  displayName: 'InstallReactTest',

  propTypes: {
    dsn: PropTypes.string,
  },

  getInitialState(props) {
    return {
      loading: true,
      error: false,
    };
  },

  render() {
    let dsn = this.props.dsn;

    return (
      <div>
        <h3> Installation </h3>
        <p>
          {' '}
          Start by adding the <span className="pre"> raven.js </span> script tag to your
          page. It should be loaded as early as possible, before your main javascript
          bundle.{' '}
        </p>
        <pre>
          <span>{'<'}</span>
          <span className="script">script </span>
          <span className="attribute">src</span>
          <span>=</span>
          <span className="value-text">
            "https://cdn.ravenjs.com/3.24.0/raven.min.js"
          </span>
          <br />
          <span className="attribute"> crossorigin</span>
          <span>=</span>
          <span className="value-text">{'anonymous'}</span>
          <span>{'>'}</span>
          <span>{'</'}</span>
          <span className="script">script</span>
          <span>{'>'}</span>
        </pre>

        <h3> Basic Configuration </h3>
        <p>{t('Next configure Raven.js to use your Sentry DSN: ')}</p>

        <pre>
          <span>{'Raven.config('}</span>
          <span className="value-text">{"'"}</span>
          <span className="value-text">{dsn}</span>
          <span>{"', {"}</span>
          <br />

          <span>{'   release: '}</span>
          <span className="value-text">{'test-1-2-3'}</span>
          <span>{','}</span>
          <br />
          <span>{'   environment: '}</span>
          <span className="value-text">{'development'}</span>
          <span>{','}</span>
          <br />
          <span>{'}).install()'}</span>
        </pre>
        <p>Congrats! Raven is now ready to capture any uncaught exceptions</p>
      </div>
    );
  },
});

export default InstallReactTest;
