import React from 'react';

import SentryTypes from 'app/sentryTypes';
import EventDataSection from 'app/components/events/eventDataSection';
import Annotated from 'app/components/events/meta/annotated';
import {t} from 'app/locale';

type Props = {
  event: SentryTypes.Event;
};

const EventSdk = ({event: {sdk: data}}: Props) => (
  <EventDataSection type="sdk" title={t('SDK')}>
    <table className="table key-value">
      <tbody>
        <tr key="name">
          <td className="key">{t('Name')}</td>
          <td className="value">
            <Annotated object={data} objectKey="name">
              {value => <pre>{value}</pre>}
            </Annotated>
          </td>
        </tr>
        <tr key="version">
          <td className="key">{t('Version')}</td>
          <td className="value">
            <Annotated object={data} objectKey="version">
              {value => <pre>{value}</pre>}
            </Annotated>
          </td>
        </tr>
      </tbody>
    </table>
  </EventDataSection>
);

export default EventSdk;
