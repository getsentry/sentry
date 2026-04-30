import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {CodeBlock} from '@sentry/scraps/code';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {KeyValueList} from 'sentry/components/events/interfaces/keyValueList';
import {GraphQlRequestBody} from 'sentry/components/events/interfaces/request/graphQlRequestBody';
import {getCurlCommand, getFullUrl} from 'sentry/components/events/interfaces/utils';
import {
  KeyValueData,
  type KeyValueDataContentProps,
} from 'sentry/components/keyValueData';
import {StructuredEventData} from 'sentry/components/structuredEventData';
import {JsonEventData} from 'sentry/components/structuredEventData/jsonEventData';
import {Truncate} from 'sentry/components/truncate';
import {IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {EntryRequest, Event} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {isUrl} from 'sentry/utils/string/isUrl';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';

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
          subject: key,
          value,
          meta: d.meta,
        };
      });

      if (!transformedData.length) {
        return null;
      }

      return (
        <KeyValueList
          data-test-id="rich-http-content-body-key-value-list"
          data={transformedData}
          isContextData
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
        <KeyValueData.Title>{t('Body')}</KeyValueData.Title>
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
      <KeyValueData.Title>{t('Body')}</KeyValueData.Title>
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
  } else if (typeof data === 'string') {
    contentItems.push({item: {key: 'data', subject: 'data', value: data}});
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

const RequestCardPanel = styled(KeyValueData.CardPanel)`
  display: block;
  pre {
    margin: 0;
  }
`;
