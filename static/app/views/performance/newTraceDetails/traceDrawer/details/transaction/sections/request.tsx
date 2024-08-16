import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import getTransformedData from 'sentry/components/events/interfaces/request/getTransformedData';
import {GraphQlRequestBody} from 'sentry/components/events/interfaces/request/graphQlRequestBody';
import {getCurlCommand, getFullUrl} from 'sentry/components/events/interfaces/utils';
import ExternalLink from 'sentry/components/links/externalLink';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {
  type StructedEventDataConfig,
  StructuredData,
} from 'sentry/components/structuredEventData';
import Truncate from 'sentry/components/truncate';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {type EntryRequest, EntryType, type EventTransaction} from 'sentry/types/event';
import type {Meta} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {isUrl} from 'sentry/utils/string/isUrl';

import {type SectionCardKeyValueList, TraceDrawerComponents} from '../../styles';

type View = 'formatted' | 'curl';

type Data = EntryRequest['data']['data'];

export function Request({event}: {event: EventTransaction}) {
  const [view, setView] = useState<View>('formatted');

  const entryIndex = event.entries.findIndex(entry => entry.type === EntryType.REQUEST);
  if (entryIndex === -1) {
    return null;
  }
  const entry = event.entries[entryIndex] as EntryRequest;
  const meta = event._meta?.entries?.[entryIndex]?.data;
  const data: EntryRequest['data'] = entry.data;
  const isPartial =
    // We assume we only have a partial interface is we're missing
    // an HTTP method. This means we don't have enough information
    // to reliably construct a full HTTP request.
    !data.method || !data.url;

  let fullUrl = getFullUrl(data);

  if (!isUrl(fullUrl)) {
    // Check if the url passed in is a safe url to avoid XSS
    fullUrl = undefined;
  }

  let parsedUrl: HTMLAnchorElement | null = null;

  if (fullUrl) {
    // use html tag to parse url, lol
    parsedUrl = document.createElement('a');
    parsedUrl.href = fullUrl;
  }

  let actions: React.ReactNode = null;

  if (!isPartial && fullUrl) {
    actions = (
      <SegmentedControl aria-label={t('View')} size="xs" value={view} onChange={setView}>
        <SegmentedControl.Item key="formatted">
          {/* Translators: this means "formatted" rendering (fancy tables) */}
          {t('Formatted')}
        </SegmentedControl.Item>
        <SegmentedControl.Item key="curl" textValue="curl">
          <Monospace>curl</Monospace>
        </SegmentedControl.Item>
      </SegmentedControl>
    );
  }

  const title = (
    <Fragment>
      <ExternalLink href={fullUrl} title={fullUrl}>
        <Path>
          <strong>{data.method || 'GET'}</strong>
          <Truncate value={parsedUrl ? parsedUrl.pathname : ''} maxLength={36} leftTrim />
        </Path>
        {fullUrl && <StyledIconOpen size="xs" />}
      </ExternalLink>
      <small>{parsedUrl ? parsedUrl.hostname : ''}</small>
    </Fragment>
  );

  const curlItems: SectionCardKeyValueList = [
    {
      key: 'curl',
      subject: t('Command'),
      value: <CodeSnippet language="bash">{getCurlCommand(data)}</CodeSnippet>,
    },
  ];

  return (
    <EventDataSection
      showPermalink={false}
      type={EntryType.REQUEST}
      title={title}
      actions={actions}
      className="request"
    >
      {view === 'formatted' ? (
        <TraceDrawerComponents.SectionCardGroup>
          {defined(data.query) && Object.keys(data.query).length > 0 ? (
            <TraceDrawerComponents.SectionCard
              items={getRequestSectionItems(data.query, meta?.query)}
              title={t('Query String')}
              sortAlphabetically
            />
          ) : null}
          {defined(data.fragment) ? (
            <TraceDrawerComponents.SectionCard
              items={[
                {
                  key: 'fragment',
                  value: (
                    <ErrorBoundary mini>
                      <pre>{data.fragment}</pre>
                    </ErrorBoundary>
                  ),
                  subject: 'fragment',
                },
              ]}
              title={t('Fragment')}
            />
          ) : null}
          {defined(data.data) ? (
            <RequestBodySection data={data} event={event} meta={meta} />
          ) : null}
          {defined(data.cookies) && Object.keys(data.cookies).length > 0 ? (
            <TraceDrawerComponents.SectionCard
              items={getRequestSectionItems(data.cookies, meta)}
              title={t('Cookies')}
              sortAlphabetically
            />
          ) : null}
          {defined(data.headers) ? (
            <TraceDrawerComponents.SectionCard
              items={getRequestSectionItems(data.headers, meta)}
              title={t('Headers')}
              sortAlphabetically
            />
          ) : null}
          {defined(data.env) ? (
            <TraceDrawerComponents.SectionCard
              items={getRequestSectionItems(data.env, meta)}
              title={t('Environment')}
              sortAlphabetically
            />
          ) : null}
        </TraceDrawerComponents.SectionCardGroup>
      ) : (
        <TraceDrawerComponents.SectionCard items={curlItems} title={t('cURL')} />
      )}
    </EventDataSection>
  );
}

const config: StructedEventDataConfig = {
  isString: value => typeof value === 'string',
  renderObjectKeys: value => `"${value}"`,
};

function RequestBodySection({
  data,
  event,
  meta,
}: {
  data: EntryRequest['data'];
  event: EventTransaction;
  meta: any;
}) {
  if (!defined(data.data)) {
    return null;
  }

  if (data.apiTarget === 'graphql' && typeof data.data.query === 'string') {
    return <GraphQlRequestBody data={data.data} {...{event, meta}} />;
  }

  const metaData = meta?.data;
  const bodyData = data.data;
  const inferredContentType = data.inferredContentType;

  if (!defined(bodyData)) {
    return null;
  }

  switch (inferredContentType) {
    case 'application/json':
      return (
        <TraceDrawerComponents.SectionCard
          items={[
            {
              key: 'body',
              value: (
                <StructuredData
                  value={bodyData}
                  config={config}
                  withAnnotatedText={false}
                  meta={metaData}
                  maxDefaultDepth={2}
                />
              ),
              subject: t('Body'),
              subjectNode: null,
            },
          ]}
          title={t('Body')}
        />
      );
    case 'application/x-www-form-urlencoded':
    case 'multipart/form-data': {
      const transformedData: SectionCardKeyValueList = getTransformedData(
        bodyData,
        metaData
      ).map(d => {
        const [key, value] = d.data;
        return {
          key,
          subject: key,
          value,
        };
      });

      if (!transformedData.length) {
        return null;
      }

      return (
        <TraceDrawerComponents.SectionCard items={transformedData} title={t('Body')} />
      );
    }

    default:
      return (
        <TraceDrawerComponents.SectionCard
          items={[
            {
              key: 'body',
              value: (
                <StructuredData
                  value={bodyData}
                  meta={metaData}
                  withAnnotatedText
                  config={config}
                  maxDefaultDepth={2}
                />
              ),
              subject: t('Body'),
              subjectNode: null,
            },
          ]}
          title={t('Body')}
        />
      );
  }
}

function getRequestSectionItems(data: Data, meta: Meta) {
  const transformedData = getTransformedData(data, meta);
  const items: SectionCardKeyValueList = transformedData
    .map(d => {
      const [key, value] = d.data;
      return {
        key,
        subject: key,
        value,
        meta: d.meta,
      };
    })
    .filter(defined);

  return items;
}

const Monospace = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
`;

const Path = styled('span')`
  color: ${p => p.theme.textColor};
  text-transform: none;
  font-weight: ${p => p.theme.fontWeightNormal};

  & strong {
    margin-right: ${space(0.5)};
  }
`;

// Nudge the icon down so it is centered. the `external-icon` class
// doesn't quite get it in place.
const StyledIconOpen = styled(IconOpen)`
  transition: 0.1s linear color;
  margin: 0 ${space(0.5)};
  color: ${p => p.theme.subText};
  position: relative;
  top: 1px;

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;
