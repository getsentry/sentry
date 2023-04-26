import {Fragment, MouseEvent, ReactNode, useState} from 'react';
import styled from '@emotion/styled';
import queryString from 'query-string';

import {KeyValueTable} from 'sentry/components/keyValueTable';
import ObjectInspector from 'sentry/components/objectInspector';
import ReplayTagsTableRow from 'sentry/components/replays/replayTagsTableRow';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatBytesBase10} from 'sentry/utils';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import useOrganization from 'sentry/utils/useOrganization';
import NetworkDetailsSetup from 'sentry/views/replays/detail/network/networkDetailsSetup';
import {TabKey} from 'sentry/views/replays/detail/network/networkDetailsTabs';
import useSDKNeedsUpdate from 'sentry/views/replays/detail/network/useSDKNeedsUpdate';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';
import type {NetworkSpan} from 'sentry/views/replays/types';

type TabProps = {
  item: NetworkSpan;
  projectId: string;
  startTimestampMs: number;
};

const MIN_REPLAY_NETWORK_BODIES_SDK = '7.44.0';

function isSupportedOp(item: NetworkSpan) {
  return ['resource.fetch', 'resource.xhr'].includes(item.op);
}

function DetailsTab({item, projectId, startTimestampMs}: TabProps) {
  const organization = useOrganization();
  const sdkNeedsUpdate = useSDKNeedsUpdate({
    minVersion: MIN_REPLAY_NETWORK_BODIES_SDK,
    organization,
    projectId,
  });

  const warnings = item.data.response?._meta?.warnings as undefined | string[];
  const isUrlSkipped = warnings?.includes('URL_SKIPPED');
  const requestHeaders = item.data.request?.headers;
  const responseHeaders = item.data.response?.headers;
  const showSetup = sdkNeedsUpdate || isUrlSkipped || !requestHeaders || !responseHeaders;

  const content = !isSupportedOp(item) ? (
    <SectionItem title={t('Headers')}>
      <NotFoundText>
        {t('Headers are only supported on fetch and xhr requests')}
      </NotFoundText>
    </SectionItem>
  ) : showSetup ? (
    <SectionItem title={t('Headers')}>
      <NetworkDetailsSetup
        minSDKVersion={MIN_REPLAY_NETWORK_BODIES_SDK}
        showSnippet="header"
        showSDKUpgrade={sdkNeedsUpdate}
        url={item.description || ''}
      />
    </SectionItem>
  ) : (
    <Fragment>
      <SectionItem title={t('Request Headers')}>
        {keyValueTablOrNotFound(requestHeaders, t('Headers not captured'))}
      </SectionItem>
      <SectionItem title={t('Response Headers')}>
        {keyValueTablOrNotFound(responseHeaders, t('Headers not captured'))}
      </SectionItem>
    </Fragment>
  );

  const {handleClick} = useCrumbHandlers(startTimestampMs);
  const startMs = item.startTimestamp * 1000;
  const endMs = item.endTimestamp * 1000;
  const data = {
    [t('URL')]: item.description,
    [t('Type')]: item.op,
    [t('Method')]: item.data.method,
    [t('Status Code')]: item.data.statusCode,
    [t('Request Body Size')]: formatBytesBase10(item.data.request?.size ?? 0),
    [t('Response Body Size')]: formatBytesBase10(item.data.response?.size ?? 0),
    [t('Duration')]: `${(endMs - startMs).toFixed(2)}ms`,
    [t('Timestamp')]: (
      <TimestampButton
        format="mm:ss.SSS"
        onClick={(event: MouseEvent) => {
          event.stopPropagation();
          handleClick(item);
        }}
        startTimestampMs={startTimestampMs}
        timestampMs={startMs}
      />
    ),
  };

  return (
    <SectionList>
      <SectionItem title={t('General')}>
        {keyValueTablOrNotFound(data, t('Missing request details'))}
      </SectionItem>
      {content}
    </SectionList>
  );
}

function RequestTab({item, projectId}: TabProps) {
  const organization = useOrganization();
  const sdkNeedsUpdate = useSDKNeedsUpdate({
    minVersion: MIN_REPLAY_NETWORK_BODIES_SDK,
    organization,
    projectId,
  });

  const warnings = item.data.request?._meta?.warnings as undefined | string[];
  const requestbody = item.data.request?.body;

  const isUrlSkipped = warnings?.includes('URL_SKIPPED');
  const isBodySkipped = warnings?.includes('BODY_SKIPPED');
  const showSetup = sdkNeedsUpdate || isUrlSkipped || isBodySkipped;

  const content = !isSupportedOp(item) ? (
    <SectionItem title={t('Request Payload')}>
      <NotFoundText>
        {t('Request Bodies are only supported on fetch and xhr requests')}
      </NotFoundText>
    </SectionItem>
  ) : showSetup ? (
    <SectionItem title={t('Request Payload')}>
      <NetworkDetailsSetup
        minSDKVersion={MIN_REPLAY_NETWORK_BODIES_SDK}
        showSnippet="bodies"
        showSDKUpgrade={sdkNeedsUpdate}
        url={item.description || ''}
      />
    </SectionItem>
  ) : (
    <SectionItem title={t('Request Payload')}>
      <WarningMessage warnings={warnings} />
      {objectInspectorOrNotFound(requestbody, t('Request Body not found'))}
    </SectionItem>
  );

  const queryParams = queryString.parse(item.description?.split('?')?.[1] ?? '');

  return (
    <SectionList>
      <SectionItem title={t('Query String Parameters')}>
        {objectInspectorOrNotFound(queryParams, t('Query Params not found'))}
      </SectionItem>
      {content}
    </SectionList>
  );
}

function ResponseTab({item, projectId}: TabProps) {
  const organization = useOrganization();
  const sdkNeedsUpdate = useSDKNeedsUpdate({
    minVersion: MIN_REPLAY_NETWORK_BODIES_SDK,
    organization,
    projectId,
  });

  const warnings = item.data.response?._meta?.warnings as undefined | string[];
  const responseBody = item.data.response?.body;

  const isUrlSkipped = warnings?.includes('URL_SKIPPED');
  const isBodySkipped = warnings?.includes('BODY_SKIPPED');
  const showSetup = sdkNeedsUpdate || isUrlSkipped || isBodySkipped;

  const content = !isSupportedOp(item) ? (
    <SectionItem title={t('Response Body')}>
      <NotFoundText>
        {t('Response Bodies are only supported on fetch and xhr requests')}
      </NotFoundText>
    </SectionItem>
  ) : showSetup ? (
    <SectionItem title={t('Response Body')}>
      <NetworkDetailsSetup
        minSDKVersion={MIN_REPLAY_NETWORK_BODIES_SDK}
        showSnippet="bodies"
        showSDKUpgrade={sdkNeedsUpdate}
        url={item.description || ''}
      />
    </SectionItem>
  ) : (
    <SectionItem title={t('Response Body')}>
      <WarningMessage warnings={warnings} />
      {objectInspectorOrNotFound(responseBody, t('Response body not found'))}
    </SectionItem>
  );

  return <SectionList>{content}</SectionList>;
}

function WarningMessage({warnings}: {warnings: undefined | string[]}) {
  const isJsonTruncated = warnings?.includes('JSON_TRUNCATED');
  const isTextTruncated = warnings?.includes('TEXT_TRUNCATED');
  if (isJsonTruncated || isTextTruncated) {
    return (
      <span>
        {t('Request Payload was truncated (~~) due to it exceeding 150k characters')}
      </span>
    );
  }
  return null;
}

function objectInspectorOrNotFound(data: any, notFoundText: string) {
  return data ? (
    <ObjectInspector data={data} expandLevel={3} />
  ) : (
    <NotFoundText>{notFoundText}</NotFoundText>
  );
}

function keyValueTablOrNotFound(data: Record<string, string>, notFoundText: string) {
  return data ? (
    <KeyValueTable noMargin>
      {Object.entries(data).map(([key, values]) => (
        <ReplayTagsTableRow key={key} name={key} values={[values]} />
      ))}
    </KeyValueTable>
  ) : (
    <NotFoundText>{notFoundText}</NotFoundText>
  );
}

function NetworkDetailsContent({
  visibleTab,
  ...tabProps
}: {visibleTab: TabKey} & TabProps) {
  switch (visibleTab) {
    case 'request':
      return <RequestTab {...tabProps} />;
    case 'response':
      return <ResponseTab {...tabProps} />;
    case 'details':
    default:
      return <DetailsTab {...tabProps} />;
  }
}

const SectionList = styled('dl')`
  height: 100%;
  margin: 0;
  overflow: auto;
  padding: ${space(1)};
`;

const SectionTitle = styled('dt')`
  margin-top: ${space(1)};
  &:first-child {
    margin-top: 0;
  }
`;

const SectionData = styled('dd')`
  font-size: ${p => p.theme.fontSizeExtraSmall};

  margin-bottom: ${space(1)};
  &:last-child {
    margin-bottom: 0;
  }
`;

const ToggleButton = styled('button')`
  background: ${p => p.theme.background};
  border: 0;
  color: ${p => p.theme.headingColor};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 600;
  line-height: ${p => p.theme.text.lineHeightBody};

  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space(1)};

  padding: ${space(0.5)} ${space(0.5)} ${space(0.5)} 0;

  :hover {
    background: ${p => p.theme.backgroundSecondary};
  }
`;

function SectionItem({title, children}: {children: ReactNode; title: string}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Fragment>
      <SectionTitle>
        <ToggleButton aria-label={t('toggle section')} onClick={() => setIsOpen(!isOpen)}>
          {title}
          <IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />
        </ToggleButton>
      </SectionTitle>
      <SectionData>{isOpen ? children : null}</SectionData>
    </Fragment>
  );
}

const NotFoundText = styled('code')`
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

export default NetworkDetailsContent;
