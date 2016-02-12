import React from 'react';
import ConfigStore from '../stores/configStore';
import HookStore from '../stores/hookStore';
import {t} from '../locale';

const Footer = React.createClass({
  getInitialState() {
    // Allow injection via getsentry et all
    let hooks = [];
    HookStore.get('footer').forEach((cb) => {
      hooks.push(cb());
    });

    return {
      hooks: hooks,
    };
  },

  render() {
    let config = ConfigStore.getConfig();
    return (
      <footer>
        <div className="container">
          <div className="pull-right">
            <a href={config.urlPrefix + '/api/'}>{t('API')}</a>
            <a href={config.urlPrefix + '/docs/'}>{t('Docs')}</a>
            <a href="https://github.com/getsentry/sentry">{t('Contribute')}</a>
          </div>
          <div className="version pull-left">
            {'Sentry'} {config.version.current}
          </div>
          <a href="/" className="icon-sentry-logo"></a>
          {this.state.hooks}
        </div>
      </footer>
    );
  }
});

export default Footer;

