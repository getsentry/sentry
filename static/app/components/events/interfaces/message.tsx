import EventDataSection from 'sentry/components/events/eventDataSection';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import Annotated from 'sentry/components/events/meta/annotated';
import {getMeta} from 'sentry/components/events/meta/metaProxy';
import {t} from 'sentry/locale';
import {objectIsEmpty} from 'sentry/utils';

type Props = {
  data: {
    formatted: string;
    params?: Record<string, any> | any[];
  };
};

const Message = ({data}: Props) => {
  const renderParams = () => {
    const params = data?.params;

    if (!params || objectIsEmpty(params)) {
      return null;
    }

    // NB: Always render params, regardless of whether they appear in the
    // formatted string due to structured logging frameworks, like Serilog. They
    // only format some parameters into the formatted string, but we want to
    // display all of them.

    if (Array.isArray(params)) {
      const arrayData = params.map((value, i) => {
        const key = `#${i}`;
        return {
          key,
          value,
          subject: key,
        };
      });

      return <KeyValueList data={arrayData} isSorted={false} isContextData />;
    }

    const objectData = Object.entries(params).map(([key, value]) => ({
      key,
      value,
      subject: key,
      meta: getMeta(params, key),
    }));

    return <KeyValueList data={objectData} isSorted={false} isContextData />;
  };

  return (
    <EventDataSection type="message" title={t('Message')}>
      <Annotated object={data} objectKey="formatted">
        {value => <pre className="plain">{value}</pre>}
      </Annotated>
      {renderParams()}
    </EventDataSection>
  );
};

export default Message;
