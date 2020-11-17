import React from 'react';

import AsyncView from 'app/views/asyncView';
import {t} from 'app/locale';

type Data = {
  groups: [groupName: string, grouppedWarnings: string[]][];
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
          <React.Fragment key={groupName}>
            <h4>{groupName}</h4>
            <ul>
              {groupedWarnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </React.Fragment>
        ))}

        {warnings.length > 0 && (
          <React.Fragment>
            <h4>Miscellaneous</h4>
            <ul>
              {warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </React.Fragment>
        )}
      </div>
    );
  }
}

export default AdminWarnings;
