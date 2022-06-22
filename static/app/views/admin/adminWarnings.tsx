import {Fragment} from 'react';

import {t} from 'sentry/locale';
import AsyncView from 'sentry/views/asyncView';

type Data = {
  groups: [groupName: string, groupedWarnings: string[]][];
  warnings: string[];
};

type State = AsyncView['state'] & {data: Data | null};

class AdminWarnings extends AsyncView<{}, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
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
