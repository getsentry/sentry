import React from 'react';
import moment from 'moment';
import styled from '@emotion/styled';

import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import ConfigStore from 'app/stores/configStore';
import {IconQuestion} from 'app/icons';
import space from 'app/styles/space';

export default class AdminEnvironment extends AsyncView {
  getEndpoints() {
    return [['data', this.getEndpoint()]];
  }

  getEndpoint() {
    return '/internal/environment/';
  }

  renderBody() {
    const {data} = this.state;
    const {environment, config, pythonVersion} = data;

    const {version} = ConfigStore.getConfig();

    return (
      <div>
        <h3>{t('Environment')}</h3>

        {environment ? (
          <dl className="vars">
            <VersionLabel>
              {t('Server Version')}
              {version.upgradeAvailable && (
                <Button
                  title={t(
                    "You're running an old version of Sentry, did you know %s is available?",
                    version.latest
                  )}
                  priority="link"
                  href="https://github.com/getsentry/sentry/releases"
                  icon={<IconQuestion size="sm" />}
                  size="small"
                  external
                />
              )}
            </VersionLabel>
            <dd>
              <pre className="val">{version.current}</pre>
            </dd>

            <dt>{t('Python Version')}</dt>
            <dd>
              <pre className="val">{pythonVersion}</pre>
            </dd>
            <dt>{t('Configuration File')}</dt>
            <dd>
              <pre className="val">{environment.config}</pre>
            </dd>
            <dt>{t('Uptime')}</dt>
            <dd>
              <pre className="val">
                {moment(environment.start_date).toNow(true)} (since{' '}
                {environment.start_date})
              </pre>
            </dd>
          </dl>
        ) : (
          <p>
            {t('Environment not found (are you using the builtin Sentry webserver?).')}
          </p>
        )}

        <h3>
          {tct('Configuration [configPath]', {
            configPath: environment.config && <small>{environment.config}</small>,
          })}
        </h3>

        <dl className="vars">
          {config.map(([key, value]) => (
            <React.Fragment key={key}>
              <dt>{key}</dt>
              <dd>
                <pre className="val">{value}</pre>
              </dd>
            </React.Fragment>
          ))}
        </dl>
      </div>
    );
  }
}

const VersionLabel = styled('dt')`
  display: inline-grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
  align-items: center;
`;
