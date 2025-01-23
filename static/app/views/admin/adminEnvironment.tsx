import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {LinkButton} from 'sentry/components/button';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconUpgrade} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';

type Data = {
  config: Array<[key: string, value: string]>;
  environment: {
    config: string;
    start_date: string;
  };
  pythonVersion: string;
};

export default function AdminEnvironment() {
  const {data, isPending, isError} = useApiQuery<Data>(['/internal/environment/'], {
    staleTime: 0,
  });

  if (isError) {
    return <LoadingError />;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  const {version} = ConfigStore.getState();

  return (
    <div>
      <h3>{t('Environment')}</h3>

      {data?.environment ? (
        <dl className="vars">
          <VersionLabel>
            {t('Server Version')}
            {version.upgradeAvailable && (
              <LinkButton
                href="https://github.com/getsentry/sentry/releases"
                icon={<IconUpgrade />}
                size="xs"
                external
              >
                {t('Upgrade to Sentry %s', version.latest)}
              </LinkButton>
            )}
          </VersionLabel>
          <dd>
            <pre className="val">{version.current}</pre>
          </dd>

          <dt>{t('Python Version')}</dt>
          <dd>
            <pre className="val">{data?.pythonVersion}</pre>
          </dd>
          <dt>{t('Configuration File')}</dt>
          <dd>
            <pre className="val">{data.environment.config}</pre>
          </dd>
          <dt>{t('Uptime')}</dt>
          <dd>
            <pre className="val">
              {tct('[now] (since [start])', {
                now: moment(data.environment.start_date).toNow(true),
                start: data.environment.start_date,
              })}
            </pre>
          </dd>
        </dl>
      ) : (
        <p>{t('Environment not found (are you using the builtin Sentry webserver?).')}</p>
      )}

      <h3>
        {tct('Configuration [configPath]', {
          configPath: data?.environment.config && (
            <small>{data?.environment.config}</small>
          ),
        })}
      </h3>

      <dl className="vars">
        {data?.config.map(([key, value]) => (
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

const VersionLabel = styled('dt')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: center;
`;
