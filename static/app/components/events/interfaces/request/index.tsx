import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import ClippedBox from 'sentry/components/clippedBox';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {GraphQlRequestBody} from 'sentry/components/events/interfaces/request/graphQlRequestBody';
import {getCurlCommand, getFullUrl} from 'sentry/components/events/interfaces/utils';
import ExternalLink from 'sentry/components/links/externalLink';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import Truncate from 'sentry/components/truncate';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {EntryRequest, EntryType, Event} from 'sentry/types/event';
import {defined, isUrl} from 'sentry/utils';

import {RichHttpContentClippedBoxBodySection} from './richHttpContentClippedBoxBodySection';
import {RichHttpContentClippedBoxKeyValueList} from './richHttpContentClippedBoxKeyValueList';

interface RequestProps {
  data: EntryRequest['data'];
  event: Event;
}

interface RequestBodyProps extends RequestProps {
  meta: any;
}

type View = 'formatted' | 'curl';

function RequestBodySection({data, event, meta}: RequestBodyProps) {
  if (!defined(data.data)) {
    return null;
  }

  if (data.apiTarget === 'graphql' && typeof data.data.query === 'string') {
    return <GraphQlRequestBody data={data.data} {...{event, meta}} />;
  }

  return (
    <RichHttpContentClippedBoxBodySection
      data={data.data}
      inferredContentType={data.inferredContentType}
      meta={meta?.data}
    />
  );
}

export function Request({data, event}: RequestProps) {
  const entryIndex = event.entries.findIndex(entry => entry.type === EntryType.REQUEST);
  const meta = event._meta?.entries?.[entryIndex]?.data;

  const [view, setView] = useState<View>('formatted');

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

  return (
    <EventDataSection
      type={EntryType.REQUEST}
      title={title}
      actions={actions}
      className="request"
    >
      {view === 'curl' ? (
        <CodeSnippet language="bash">{getCurlCommand(data)}</CodeSnippet>
      ) : (
        <Fragment>
          {defined(data.query) && (
            <RichHttpContentClippedBoxKeyValueList
              title={t('Query String')}
              data={data.query}
              meta={meta?.query}
              isContextData
            />
          )}
          {defined(data.fragment) && (
            <ClippedBox title={t('Fragment')}>
              <ErrorBoundary mini>
                <pre>{data.fragment}</pre>
              </ErrorBoundary>
            </ClippedBox>
          )}
          <RequestBodySection {...{data, event, meta}} />
          {defined(data.cookies) && Object.keys(data.cookies).length > 0 && (
            <RichHttpContentClippedBoxKeyValueList
              defaultCollapsed
              title={t('Cookies')}
              data={data.cookies}
              meta={meta?.cookies}
            />
          )}
          {defined(data.headers) && (
            <RichHttpContentClippedBoxKeyValueList
              title={t('Headers')}
              data={data.headers}
              meta={meta?.headers}
            />
          )}
          {defined(data.env) && (
            <RichHttpContentClippedBoxKeyValueList
              defaultCollapsed
              title={t('Environment')}
              data={data.env}
              meta={meta?.env}
            />
          )}
        </Fragment>
      )}
    </EventDataSection>
  );
}

const Monospace = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
`;

const Path = styled('span')`
  color: ${p => p.theme.textColor};
  text-transform: none;
  font-weight: normal;

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
