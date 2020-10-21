import {Fragment} from 'react';

import AsyncView from 'app/views/asyncView';
import {t} from 'app/locale';

export default class AdminSettings extends AsyncView {
  getEndpoints() {
    return [['data', this.getEndpoint()]];
  }

  getEndpoint() {
    return '/internal/warnings/';
  }

  renderBody() {
    const {data} = this.state;
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
