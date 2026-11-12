import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {BreadcrumbTitle} from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle';

type Data = {
  extensions: Array<[key: string, value: string]>;
  modules: Array<[key: string, value: string]>;
};

export default function AdminPackages() {
  return (
    <Fragment>
      <BreadcrumbTitle title={t('Packages')} />
      <AdminPackagesContent />
    </Fragment>
  );
}

function AdminPackagesContent() {
  const {data, isPending, isError} = useQuery(
    apiOptions.as<Data>()('/internal/packages/', {staleTime: 0})
  );

  if (isError) {
    return <LoadingError />;
  }

  if (isPending) {
    return <LoadingIndicator />;
  }

  return (
    <div>
      <h3>{t('Extensions')}</h3>

      {data?.extensions && data?.extensions.length > 0 ? (
        <dl className="vars">
          {data?.extensions.map(([key, value]) => (
            <Fragment key={key}>
              <dt>{key}</dt>
              <dd>
                <pre className="val">{value}</pre>
              </dd>
            </Fragment>
          ))}
        </dl>
      ) : (
        <p>{t('No extensions registered')}</p>
      )}

      <h3>{t('Modules')}</h3>

      {data?.modules && data?.modules.length > 0 ? (
        <dl className="vars">
          {data?.modules.map(([key, value]) => (
            <Fragment key={key}>
              <dt>{key}</dt>
              <dd>
                <pre className="val">{value}</pre>
              </dd>
            </Fragment>
          ))}
        </dl>
      ) : (
        <p>{t('No modules registered')}</p>
      )}
    </div>
  );
}
