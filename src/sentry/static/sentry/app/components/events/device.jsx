import React from 'react';

import EventDataSection from 'app/components/events/eventDataSection';
import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import ContextData from 'app/components/contextData';

// TODO(hazat): Is this interface used somewhere? If not delete it?
class DeviceInterface extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
  };

  render() {
    const {event} = this.props;
    const data = event.device;
    const extras = Object.keys(data.data || {}).map(key => {
      const value = data.data[key];
      return (
        <tr key={key}>
          <td className="key">{key}</td>
          <td className="value">
            <ContextData data={value} />
          </td>
        </tr>
      );
    });

    return (
      <EventDataSection event={event} type="device" title={t('Device')} wrapTitle>
        <table className="table key-value">
          <tbody>
            {data.name && (
              <tr>
                <td className="key">Name</td>
                <td className="value">
                  <pre>{data.name}</pre>
                </td>
              </tr>
            )}
            {data.version && (
              <tr>
                <td className="key">Version</td>
                <td className="value">
                  <pre>{data.version}</pre>
                </td>
              </tr>
            )}
            {data.build && (
              <tr>
                <td className="key">Build</td>
                <td className="value">
                  <pre>{data.build}</pre>
                </td>
              </tr>
            )}
            {extras}
          </tbody>
        </table>
      </EventDataSection>
    );
  }
}

export default DeviceInterface;
