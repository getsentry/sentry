import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {CodeBlock} from '@sentry/scraps/code';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {GraphQlRequestBody} from 'sentry/components/events/interfaces/request/graphQlRequestBody';
import {getCurlCommand, getFullUrl} from 'sentry/components/events/interfaces/utils';
import {KeyValue, KeyValuePanel, type KeyValueEntry} from 'sentry/components/keyValue';
import {StructuredEventData} from 'sentry/components/structuredEventData';
import {JsonEventData} from 'sentry/components/structuredEventData/jsonEventData';
import {Truncate} from 'sentry/components/truncate';
import {IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {EntryRequest, Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {defined} from 'sentry/utils/defined';
import {isValidUrl} from 'sentry/utils/string/isValidUrl';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

import {getTransformedData} from './getTransformedData';

interface RequestProps {
  data: EntryRequest['data'];
  event: Event;
}

interface RequestBodyProps extends RequestProps {
  meta: any;
}

type View = 'formatted' | 'curl';

function getBodyContent({
  data,
  meta,
  inferredContentType,
}: {
  data: EntryRequest['data']['data'];
  inferredContentType: EntryRequest['data']['inferredContentType'];
  meta: Record<any, any> | undefined;
}) {
  switch (inferredContentType) {
    case 'application/json':
      return (
        <JsonEventData
          data-test-id="rich-http-content-body-context-data"
          data={data}
          showCopyButton
        />
      );
    case 'application/x-www-form-urlencoded':
    case 'multipart/form-data': {
      const transformedData = getTransformedData(data, meta).map(d => {
        const [key, value] = d.data;
        return {
          key,
          value,
          meta: d.meta,
        };
      });

      if (!transformedData.length) {
        return null;
      }

      return (
        <KeyValue
          data-test-id="rich-http-content-body-key-value-list"
          items={transformedData}
          layout="detail"
          sort="key"
          valueDisplay="expandable"
        />
      );
    }

    default:
      return (
        <pre data-test-id="rich-http-content-body-section-pre">
          <StructuredEventData data={data} meta={meta} withAnnotatedText showCopyButton />
        </pre>
      );
  }
}

function RequestBodySection({data, event, meta}: RequestBodyProps) {
  if (!defined(data.data)) {
    return null;
  }

  if (data.apiTarget === 'graphql' && typeof data.data.query === 'string') {
    return (
      <RequestCardPanel>
        <KeyValue.Title>{t('Body')}</KeyValue.Title>
        <GraphQlRequestBody data={data.data} {...{event, meta}} />
      </RequestCardPanel>
    );
  }

  const contentBody = getBodyContent({
    data: data.data,
    meta: meta?.data,
    inferredContentType: data.inferredContentType,
  });
  return (
    <RequestCardPanel>
      <KeyValue.Title>{t('Body')}</KeyValue.Title>
      {contentBody}
    </RequestCardPanel>
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

  if (!isValidUrl(fullUrl)) {
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
          <Text monospace>curl</Text>
        </SegmentedControl.Item>
      </SegmentedControl>
    );
  }

  const title = (
    <TruncatedPathLink method={data.method} url={parsedUrl} fullUrl={fullUrl} />
  );

  return (
    <FoldSection
      sectionKey={SectionKey.REQUEST}
      title={t('HTTP Request')}
      actions={actions}
    >
      {title}
      {view === 'curl' ? (
        <CodeBlock language="bash">{getCurlCommand(data)}</CodeBlock>
      ) : (
        <Fragment>
          <RequestBodySection data={data} event={event} meta={meta} />
          <RequestDataCard
            title={t('Query String')}
            data={data.query}
            meta={meta?.query}
          />
          <RequestDataCard title={t('Fragment')} data={data.fragment} meta={undefined} />
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

  const contentItems: KeyValueEntry[] = [];

  if (Array.isArray(data) && data.length > 0) {
    data
      // Remove any non-tuple values
      .filter(x => Array.isArray(x))
      .forEach(([key, value], i: number) => {
        const valueMeta = meta?.[i] ? meta[i]?.[1] : undefined;
        contentItems.push({key, value, meta: valueMeta});
      });
  } else if (typeof data === 'object') {
    // Spread to flatten if it's a proxy
    Object.entries({...data}).forEach(([key, value]) => {
      const valueMeta = meta ? meta[key] : undefined;
      contentItems.push({key, value, meta: valueMeta});
    });
  } else if (typeof data === 'string') {
    contentItems.push({key: 'data', subject: 'data', value: data});
  }

  return (
    <ErrorBoundary
      mini
      message={tct('There was an error loading data: [title]', {title})}
    >
      <KeyValue
        title={title}
        items={contentItems}
        truncateLength={5}
        card
        layout="detail"
      />
    </ErrorBoundary>
  );
}

interface TruncatedPathLinkProps {
  fullUrl?: string;
  method?: string | null;
  url?: HTMLAnchorElement | null;
}
function TruncatedPathLink(props: TruncatedPathLinkProps) {
  return (
    <Flex as="span" gap="sm" align="baseline" padding="0 0 md 0">
      <Text bold>{props.method || 'GET'}</Text>
      <ExternalLink openInNewTab href={props.fullUrl} title={props.fullUrl}>
        <Flex gap="xs" align="baseline">
          {flexProps => (
            <Text {...flexProps} variant="primary">
              <Truncate value={props.url?.pathname ?? ''} maxLength={36} leftTrim />
              {props.fullUrl && (
                <IconOpen style={{transform: 'translateY(1px)'}} size="xs" />
              )}
            </Text>
          )}
        </Flex>
      </ExternalLink>
      <Text variant="muted">{props.url?.hostname ?? ''}</Text>
    </Flex>
  );
}

const RequestCardPanel = styled(KeyValuePanel)`
  display: block;
  pre {
    margin: 0;
  }
`;
