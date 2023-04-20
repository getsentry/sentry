import {MouseEvent} from 'react';
import styled from '@emotion/styled';
import queryString from 'query-string';

import {KeyValueTable} from 'sentry/components/keyValueTable';
import ObjectInspector from 'sentry/components/objectInspector';
import ReplayTagsTableRow from 'sentry/components/replays/replayTagsTableRow';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatBytesBase10} from 'sentry/utils';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import FluidPanel from 'sentry/views/replays/detail/layout/fluidPanel';
import {TabKey} from 'sentry/views/replays/detail/network/networkDetailsTabs';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';
import type {NetworkSpan} from 'sentry/views/replays/types';

type TabProps = {
  item: NetworkSpan;
  startTimestampMs: number;
};

function DetailsTab({item, startTimestampMs}: TabProps) {
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
    <FluidPanel>
      <KeyValueTable noMargin>
        {Object.entries(data).map(([key, values]) => (
          <ReplayTagsTableRow key={key} name={key} values={[values]} />
        ))}
      </KeyValueTable>
    </FluidPanel>
  );
}

function objectInspectorOrNotFound(data, notFoundText: string) {
  return data ? (
    <ObjectInspector data={data} expandLevel={3} />
  ) : (
    <NotFoundText>{notFoundText}</NotFoundText>
  );
}

function RequestTab({item}: TabProps) {
  const queryParams = queryString.parse(item.description?.split('?')?.[1] ?? '');
  const query = objectInspectorOrNotFound(queryParams, t('Query Params not found'));
  const request = objectInspectorOrNotFound(
    item.data?.request?.body,
    t('Request Body not found')
  );

  return (
    <SectionList>
      <SectionTitle>{t('Query String Parameters')}</SectionTitle>
      <SectionData>{query}</SectionData>
      <SectionTitle>{t('Request Payload')}</SectionTitle>
      <SectionData>{request}</SectionData>
    </SectionList>
  );
}

function ResponseTab({item}: TabProps) {
  const response = objectInspectorOrNotFound(
    item.data?.response?.body,
    t('Response body not found')
  );

  return (
    <SectionList>
      <SectionTitle>{t('Response Body')}</SectionTitle>
      <SectionData>{response}</SectionData>
    </SectionList>
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
  overflow: scroll;
  padding: ${space(1)};
`;

const SectionTitle = styled('dt')`
  ${p => p.theme.overflowEllipsis};
  text-transform: capitalize;
  font-weight: 600;
  color: ${p => p.theme.gray400};
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const SectionData = styled('dd')`
  font-size: ${p => p.theme.fontSizeExtraSmall};

  margin-bottom: ${space(2)};
  &:last-child {
    margin-bottom: 0;
  }
`;

const NotFoundText = styled('code')`
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

export default NetworkDetailsContent;
