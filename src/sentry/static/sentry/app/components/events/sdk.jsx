import React from 'react';
import SentryTypes from 'app/sentryTypes';

import EventDataSection from 'app/components/events/eventDataSection';
import {t} from 'app/locale';

class EventSdk extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
  };

  render() {
    const {event} = this.props;
    const data = event.sdk;

    return (
      <EventDataSection event={event} type="sdk" title={t('SDK')} wrapTitle>
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
      </EventDataSection>
    );
  }
}

export default EventSdk;
