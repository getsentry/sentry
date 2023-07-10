import {Fragment} from 'react';

import {t} from 'sentry/locale';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';

type Data = {
  groups: [groupName: string, grouppedWarnings: string[]][];
  warnings: string[];
};

type State = DeprecatedAsyncView['state'] & {data: Data | null};

class AdminWarnings extends DeprecatedAsyncView<{}, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    return [['data', '/internal/warnings/']];
  }

  renderBody() {
    const {data} = this.state;

    if (data === null) {
      return null;
    }

    const {groups, warnings} = data;

    return (
      <div>
        <h3>{t('System Warnings')}</h3>
        {!warnings && !groups && t('There are no warnings at this time')}

        {groups.map(([groupName, groupedWarnings]) => (
          <Fragment key={groupName}>
            <h4>{groupName}</h4>
            <ul>
              {groupedWarnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </Fragment>
        ))}

        {warnings.length > 0 && (
          <Fragment>
            <h4>Miscellaneous</h4>
            <ul>
              {warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </Fragment>
        )}
      </div>
    );
  }
}

export default AdminWarnings;
