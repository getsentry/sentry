import styled from '@emotion/styled';

import {renderLinksInText} from 'sentry/components/events/interfaces/crashContent/exception/utils';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

type Props = {
  data: {
    formatted: string | null;
    params?: Record<string, any> | any[] | null;
  };
  event: Event;
};

function renderParams(params: Props['data']['params'], meta: any) {
  if (!params || isEmptyObject(params)) {
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

    return <KeyValueList data={arrayData} shouldSort={false} isContextData />;
  }

  const objectData = Object.entries(params).map(([key, value]) => ({
    key,
    value,
    subject: key,
    meta: meta?.data?.params?.[key]?.[''],
  }));

  return <KeyValueList data={objectData} shouldSort={false} isContextData />;
}

export function Message({data, event}: Props) {
  const entryIndex = event.entries.findIndex(entry => entry.type === EntryType.MESSAGE);
  const meta = event?._meta?.entries?.[entryIndex] ?? {};
  const messageData = data.formatted
    ? renderLinksInText({exceptionText: data.formatted})
    : null;

  return (
    <InterimSection title={t('Message')} type={SectionKey.MESSAGE}>
      <PlainPre>
        <AnnotatedText value={messageData} meta={meta?.data?.formatted?.['']} />
      </PlainPre>
      {renderParams(data.params, meta)}
    </InterimSection>
  );
}

const PlainPre = styled('pre')`
  background-color: inherit;
  padding: 0;
  border: 0;
  margin-bottom: 0;
  white-space: pre-wrap;
  word-break: break-all;
`;
