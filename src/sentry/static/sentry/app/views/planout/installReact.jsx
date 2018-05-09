import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import {t} from 'app/locale';

const InstallReactTest = createReactClass({
  displayName: 'ProjectInstallPlatform',

  propTypes: {
    dsn: PropTypes.str,
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
        <h2> Installation </h2>
        <p>
          {' '}
          Start by adding the <span className="pre"> raven.js </span> script tag to your
          page. It should be loaded as early as possible, before your main javascript
          bundle.{' '}
        </p>
        <pre>
          <span style={{color: '#111111'}}>{'<'}</span>
          <span style={{color: '#2eb0f7'}}>script </span>
          <span style={{color: '#a47ac6'}}>src</span>
          <span style={{color: '#111111'}}>=</span>
          <span style={{color: '#e8535a'}}>
            "https://cdn.ravenjs.com/3.24.0/raven.min.js"
          </span>
          <br />
          <span style={{color: '#a47ac6'}}> crossorigin</span>
          <span style={{color: '#111111'}}>=</span>
          <span style={{color: '#e8535a'}}>{'anonymous'}</span>
          <span style={{color: '#111111'}}>{'>'}</span>
          <span style={{color: '#111111'}}>{'</'}</span>
          <span style={{color: '#2eb0f7'}}>script</span>
          <span style={{color: '#111111'}}>{'>'}</span>
        </pre>

        <h2> Basic Configuration </h2>
        <p>{t('Next configure Raven.js to use your Sentry DSN: ')}</p>

        <pre>
          <span style={{color: '#111111'}}>{'Raven.config('}</span>
          <span style={{color: '#e8535a'}}>{"'"}</span>
          <span style={{color: '#e8535a'}}>{dsn}</span>
          <span style={{color: '#111111'}}>{"', {"}</span>
          <br />

          <span style={{color: '#111111'}}>{'   release: '}</span>
          <span style={{color: '#e8535a'}}>{'test-1-2-3'}</span>
          <span style={{color: '#111111'}}>{','}</span>
          <br />
          <span style={{color: '#111111'}}>{'   environment: '}</span>
          <span style={{color: '#e8535a'}}>{'development'}</span>
          <span style={{color: '#111111'}}>{','}</span>
          <br />
          <span style={{color: '#111111'}}>{'}).install()'}</span>
        </pre>
        <p>Congrats! Raven is now ready to capture any uncaught exceptions</p>
      </div>
    );
  },
});

export default InstallReactTest;
