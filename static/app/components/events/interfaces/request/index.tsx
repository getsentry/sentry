import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import ClippedBox from 'sentry/components/clippedBox';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {GraphQlRequestBody} from 'sentry/components/events/interfaces/request/graphQlRequestBody';
import {getCurlCommand, getFullUrl} from 'sentry/components/events/interfaces/utils';
import KeyValueData, {
  type KeyValueDataContentProps,
} from 'sentry/components/keyValueData';
import ExternalLink from 'sentry/components/links/externalLink';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import Truncate from 'sentry/components/truncate';
import {IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EntryRequest, Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {isUrl} from 'sentry/utils/string/isUrl';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

import {
  getBodyContent,
  RichHttpContentClippedBoxBodySection,
} from './richHttpContentClippedBoxBodySection';
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
  const hasStreamlinedUI = useHasStreamlinedUI();

  if (!defined(data.data)) {
    return null;
  }

  if (data.apiTarget === 'graphql' && typeof data.data.query === 'string') {
    return hasStreamlinedUI ? (
      <RequestCardPanel>
        <KeyValueData.Title>{t('Body')}</KeyValueData.Title>
        <GraphQlRequestBody data={data.data} {...{event, meta}} />
      </RequestCardPanel>
    ) : (
      <GraphQlRequestBody data={data.data} {...{event, meta}} />
    );
  }

  if (hasStreamlinedUI) {
    const contentBody = getBodyContent({
      data: data.data,
      meta: meta?.data,
      inferredContentType: data.inferredContentType,
    });
    return (
      <RequestCardPanel>
        <KeyValueData.Title>{t('Body')}</KeyValueData.Title>
        {contentBody}
      </RequestCardPanel>
    );
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
  const hasStreamlinedUI = useHasStreamlinedUI();
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

  if (hasStreamlinedUI) {
    return (
      <FoldSection
        sectionKey={SectionKey.REQUEST}
        title={t('HTTP Request')}
        actions={actions}
      >
        <SummaryLine>{title}</SummaryLine>
        {view === 'curl' ? (
          <CodeSnippet language="bash">{getCurlCommand(data)}</CodeSnippet>
        ) : (
          <Fragment>
            <RequestBodySection data={data} event={event} meta={meta} />
            <RequestDataCard
              title={t('Query String')}
              data={data.query}
              meta={meta?.query}
            />
            <RequestDataCard
              title={t('Fragment')}
              data={data.fragment}
              meta={undefined}
            />
            <RequestDataCard
              title={t('Cookies')}
              data={data.cookies}
              meta={meta?.cookies}
            />
            <RequestDataCard
              title={t('Headers')}
              data={data.headers}
              meta={meta?.headers}
            />
            <RequestDataCard title={t('Environment')} data={data.env} meta={meta?.env} />
          </Fragment>
        )}
      </FoldSection>
    );
  }

  return (
    <EventDataSection
      type={SectionKey.REQUEST}
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

function RequestDataCard({
  title,
  data,
  meta,
}: {
  data: EntryRequest['data']['data'];
  meta: Record<string, any> | undefined | null;
  title: string;
}) {
  if (!defined(data)) {
    return null;
  }

  const contentItems: KeyValueDataContentProps[] = [];

  if (Array.isArray(data) && data.length > 0) {
    data
      // Remove any non-tuple values
      .filter(x => Array.isArray(x))
      .forEach(([key, value], i: number) => {
        const valueMeta = meta?.[i] ? meta[i]?.[1] : undefined;
        contentItems.push({item: {key, subject: key, value}, meta: valueMeta});
      });
  } else if (typeof data === 'object') {
    // Spread to flatten if it's a proxy
    Object.entries({...data}).forEach(([key, value]) => {
      const valueMeta = meta ? meta[key] : undefined;
      contentItems.push({item: {key, subject: key, value}, meta: valueMeta});
    });
  }

  return (
    <ErrorBoundary
      mini
      message={tct('There was an error loading data: [title]', {title})}
    >
      <KeyValueData.Card title={title} contentItems={contentItems} truncateLength={5} />
    </ErrorBoundary>
  );
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

const SummaryLine = styled('div')`
  margin-bottom: ${space(1)};
`;

const RequestCardPanel = styled(KeyValueData.CardPanel)`
  display: block;
  pre {
    margin: 0;
  }
`;
