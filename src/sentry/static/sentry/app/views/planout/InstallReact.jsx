import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
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
          {t('Start by adding the')}
          <span className="pre"> raven.js </span>{' '}
          {t(`script tag to your
          page. It should be loaded as early as possible, before your main javascript
          bundle.`)}
        </p>
        <pre>
          <span>{'<'}</span>
          <ScriptSpan>script </ScriptSpan>
          <AttributeSpan>src</AttributeSpan>
          <span>=</span>
          <ValueSpan>{t('https://cdn.ravenjs.com/3.24.0/raven.min.js')}</ValueSpan>
          <br />
          <AttributeSpan> crossorigin</AttributeSpan>
          <span>=</span>
          <ValueSpan>{'anonymous'}</ValueSpan>
          <span>{'></'}</span>
          <ScriptSpan>script</ScriptSpan>
          <span>{'>'}</span>
        </pre>

        <h3> Basic Configuration </h3>
        <p>
          {t(`Next configure Raven.js to use your Sentry DSN. Sending release and environment data both provide valuable
          context e.g. when an issue was first seen. Learn more about `)}
          <a href="https://docs.sentry.io/clients/javascript/config/">
            {' '}
            configuration options{' '}
          </a>here.
        </p>

        <pre>
          <span>
            {'<'}
            <ScriptSpan>script</ScriptSpan>
            {'>'}
          </span>
          <br />
          <span>{' Raven.config('}</span>
          <ValueSpan>'{dsn}'</ValueSpan>
          <span>{', {'}</span>
          <br />

          <span>{'   release: '}</span>
          <ValueSpan>{"'0-0-0'"}</ValueSpan>
          <span>{','}</span>
          <br />
          <span>{'   environment: '}</span>
          <ValueSpan>{"'development-test'"}</ValueSpan>
          <span>{','}</span>
          <br />
          <span>{' }).install()'}</span>
          <br />
          <span>
            {'</'}
            <ScriptSpan>script</ScriptSpan>
            {'>'}
          </span>
          <br />
        </pre>

        <p>Congrats! Raven is now ready to capture any uncaught exceptions</p>
      </div>
    );
  },
});

const ScriptSpan = styled('span')`
  color: #2eb0f7;
`;
const AttributeSpan = styled('span')`
  color: #a47ac6;
`;
const ValueSpan = styled('span')`
  color: #e8535a;
`;

export default InstallReactTest;
