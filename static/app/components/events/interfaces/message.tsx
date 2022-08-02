import EventDataSection from 'sentry/components/events/eventDataSection';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import AnnotatedText from 'sentry/components/events/meta/annotatedText';
import {t} from 'sentry/locale';
import {EntryType, Event} from 'sentry/types';
import {objectIsEmpty} from 'sentry/utils';

type Props = {
  data: {
    formatted: string | null;
    params?: Record<string, any> | any[] | null;
  };
  event: Event;
};

export function Message({data, event}: Props) {
  const messageEntryIndex = event.entries.findIndex(
    entry => entry.type === EntryType.MESSAGE
  );
  const meta = event?._meta?.entries?.[messageEntryIndex] ?? {};

  function renderParams() {
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
          meta: meta?.data?.params?.[i]?.[''],
        };
      });

      return <KeyValueList data={arrayData} isSorted={false} isContextData />;
    }

    const objectData = Object.entries(params).map(([key, value]) => ({
      key,
      value,
      subject: key,
      meta: meta?.data?.params?.[key]?.[''],
    }));

    return <KeyValueList data={objectData} isSorted={false} isContextData />;
  }

  return (
    <EventDataSection type="message" title={t('Message')}>
      {meta?.data?.formatted?.[''] ? (
        <AnnotatedText value={data.formatted} meta={meta?.data?.formatted?.['']} />
      ) : (
        <pre className="plain">{data.formatted}</pre>
      )}
      {renderParams()}
    </EventDataSection>
  );
}
