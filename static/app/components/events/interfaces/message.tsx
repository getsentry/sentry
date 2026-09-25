import styled from '@emotion/styled';

import {renderLinksInText} from 'sentry/components/events/interfaces/crashContent/exception/utils';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {StructuredData} from 'sentry/components/structuredEventData';
import {KeyValueTableCard} from 'sentry/components/tables/keyValueTable';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

type Props = {
  data: {
    formatted: string | null;
    params?: Record<string, any> | any[] | null;
  };
  event: Event;
};

function renderParams(params: Props['data']['params'], meta: any) {
  if (!params || (Array.isArray(params) ? params.length === 0 : isEmptyObject(params))) {
    return null;
  }

  // NB: Always render params, regardless of whether they appear in the
  // formatted string due to structured logging frameworks, like Serilog. They
  // only format some parameters into the formatted string, but we want to
  // display all of them.

  const entries = Array.isArray(params)
    ? params.map((value, i) => [`#${i}`, value, meta?.data?.params?.[i]?.['']] as const)
    : Object.entries(params).map(
        ([key, value]) => [key, value, meta?.data?.params?.[key]?.['']] as const
      );

  return (
    <KeyValueTableCard
      variant="label"
      contentItems={entries.map(([key, value, valueMeta]) => ({
        item: {
          key,
          subject: key,
          value: (
            <StructuredData
              withAnnotatedText
              value={value}
              maxDefaultDepth={2}
              meta={valueMeta}
            />
          ),
        },
      }))}
    />
  );
}

export function Message({data, event}: Props) {
  const entryIndex = event.entries.findIndex(entry => entry.type === EntryType.MESSAGE);
  const meta = event?._meta?.entries?.[entryIndex] ?? {};
  const messageData = data.formatted
    ? renderLinksInText({exceptionText: data.formatted})
    : null;

  return (
    <FoldSection title={t('Message')} sectionKey={SectionKey.MESSAGE}>
      <PlainPre>
        <AnnotatedText value={messageData} meta={meta?.data?.formatted?.['']} />
      </PlainPre>
      {renderParams(data.params, meta)}
    </FoldSection>
  );
}

const PlainPre = styled('pre')`
  background-color: inherit;
  padding: 0;
  border: 0;
  margin-bottom: 0;
  white-space: pre-wrap;
  overflow-x: unset;
  word-break: break-all;
`;
