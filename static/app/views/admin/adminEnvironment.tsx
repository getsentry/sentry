import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import {Button} from 'sentry/components/button';
import {IconUpgrade} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';

type Data = {
  config: [key: string, value: string][];
  environment: {
    config: string;
    start_date: string;
  };
  pythonVersion: string;
};

type State = DeprecatedAsyncView['state'] & {data: Data};

export default class AdminEnvironment extends DeprecatedAsyncView<{}, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    return [['data', '/internal/environment/']];
  }

  renderBody() {
    const {data} = this.state;
    const {environment, config, pythonVersion} = data;

    const {version} = ConfigStore.getState();

    return (
      <div>
        <h3>{t('Environment')}</h3>

        {environment ? (
          <dl className="vars">
            <VersionLabel>
              {t('Server Version')}
              {version.upgradeAvailable && (
                <Button
                  href="https://github.com/getsentry/sentry/releases"
                  icon={<IconUpgrade />}
                  size="xs"
                  external
                >
                  {t('Upgrade to Sentry %s', version.latest)}
                </Button>
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
            <Fragment key={key}>
              <dt>{key}</dt>
              <dd>
                <pre className="val">{value}</pre>
              </dd>
            </Fragment>
          ))}
        </dl>
      </div>
    );
  }
}

const VersionLabel = styled('dt')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: center;
`;
