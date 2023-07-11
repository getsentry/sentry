import {Fragment} from 'react';

import {t} from 'sentry/locale';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';

type Data = {
  extensions: [key: string, value: string][];
  modules: [key: string, value: string][];
};

type State = DeprecatedAsyncView['state'] & {data: Data};

export default class AdminPackages extends DeprecatedAsyncView<{}, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    return [['data', '/internal/packages/']];
  }

  renderBody() {
    const {data} = this.state;
    const {extensions, modules} = data;

    return (
      <div>
        <h3>{t('Extensions')}</h3>

        {extensions.length > 0 ? (
          <dl className="vars">
            {extensions.map(([key, value]) => (
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

        {modules.length > 0 ? (
          <dl className="vars">
            {modules.map(([key, value]) => (
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
}
