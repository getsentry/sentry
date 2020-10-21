import {Event} from 'app/types';
import EventDataSection from 'app/components/events/eventDataSection';
import Annotated from 'app/components/events/meta/annotated';
import {t} from 'app/locale';

type Props = {
  sdk: NonNullable<Event['sdk']>;
};

const EventSdk = ({sdk}: Props) => (
  <EventDataSection type="sdk" title={t('SDK')}>
    <table className="table key-value">
      <tbody>
        <tr key="name">
          <td className="key">{t('Name')}</td>
          <td className="value">
            <Annotated object={sdk} objectKey="name">
              {value => <pre className="val-string">{value}</pre>}
            </Annotated>
          </td>
        </tr>
        <tr key="version">
          <td className="key">{t('Version')}</td>
          <td className="value">
            <Annotated object={sdk} objectKey="version">
              {value => <pre className="val-string">{value}</pre>}
            </Annotated>
          </td>
        </tr>
      </tbody>
    </table>
  </EventDataSection>
);

export default EventSdk;
