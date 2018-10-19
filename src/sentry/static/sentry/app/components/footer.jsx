import React from 'react';
import ConfigStore from 'app/stores/configStore';
import HookStore from 'app/stores/hookStore';
import {t} from 'app/locale';
import DynamicWrapper from 'app/components/dynamicWrapper';

const Footer = p => {
  const config = ConfigStore.getConfig();
  return (
    <footer>
      <div className="container">
        <div className="pull-right">
          <a className="hidden-xs" href="/api/">
            {t('API')}
          </a>
          <a href="/docs/">{t('Docs')}</a>
          <a
            className="hidden-xs"
            href="https://github.com/getsentry/sentry"
            rel="noreferrer"
          >
            {t('Contribute')}
          </a>
          {config.isOnPremise && (
            <a className="hidden-xs" href="/out/">
              {t('Migrate to SaaS')}
            </a>
          )}
        </div>
        {config.isOnPremise && (
          <div className="version pull-left">
            {'Sentry '}
            <DynamicWrapper fixed="Acceptance Test" value={config.version.current} />
          </div>
        )}
        <a href="/" className="icon-sentry-logo" />
        {HookStore.get('footer').map(cb => cb())}
      </div>
    </footer>
  );
};

export default Footer;
