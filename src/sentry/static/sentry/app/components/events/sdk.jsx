import React from 'react';
import SentryTypes from 'app/sentryTypes';

import GroupEventDataSection from 'app/components/events/eventDataSection';
import {t} from 'app/locale';

class EventSdk extends React.Component {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
    event: SentryTypes.Event.isRequired,
  };

  render() {
    const {group, event} = this.props;
    const data = event.sdk;

    return (
      <GroupEventDataSection
        group={group}
        event={event}
        type="sdk"
        title={t('SDK')}
        wrapTitle={true}
      >
        <table className="table key-value">
          <tbody>
            <tr key="name">
              <td className="key">{t('Name')}</td>
              <td className="value">
                <pre>{data.name}</pre>
              </td>
            </tr>
            <tr key="version">
              <td className="key">{t('Version')}</td>
              <td className="value">
                <pre>{data.version}</pre>
              </td>
            </tr>
          </tbody>
        </table>
      </GroupEventDataSection>
    );
  }
}

export default EventSdk;
