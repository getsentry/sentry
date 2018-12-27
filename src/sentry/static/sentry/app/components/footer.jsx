import React from 'react';

import {t} from 'app/locale';
import ConfigStore from 'app/stores/configStore';
import DynamicWrapper from 'app/components/dynamicWrapper';
import Hook from 'app/components/hook';

const Footer = () => {
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
        <Hook name="footer" />
      </div>
    </footer>
  );
};

export default Footer;
