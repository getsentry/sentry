import ContextData from 'sentry/components/contextData';
import EventDataSection from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';
import {Event} from 'sentry/types/event';

type Props = {
  event: Event;
};

const DeviceInterface = ({event}: Props) => {
  const data = event.device || {};
  const extras = Object.entries<any>(data.data || {}).map(([key, value]) => {
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
    <EventDataSection type="device" title={t('Device')} wrapTitle>
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
};

export default DeviceInterface;
