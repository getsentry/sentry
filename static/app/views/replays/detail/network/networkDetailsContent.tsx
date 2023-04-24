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
    <SectionList>
      <ExpandoSection title={t('General')}>
        {keyValueTablOrNotFound(data, t('Missing request details'))}
      </ExpandoSection>
      <ExpandoSection title={t('Request Headers')}>
        {keyValueTablOrNotFound(item.data.request?.headers, t('Headers not captured'))}
      </ExpandoSection>
      <ExpandoSection title={t('Response Headers')}>
        {keyValueTablOrNotFound(item.data.request?.headers, t('Headers not captured'))}
      </ExpandoSection>
    </SectionList>
  );
}

function RequestTab({item}: TabProps) {
  const queryParams = queryString.parse(item.description?.split('?')?.[1] ?? '');

  return (
    <SectionList>
      <ExpandoSection title={t('Query String Parameters')}>
        {objectInspectorOrNotFound(queryParams, t('Query Params not found'))}
      </ExpandoSection>
      <ExpandoSection title={t('Request Payload')}>
        {objectInspectorOrNotFound(item.data?.request?.body, t('Request Body not found'))}
      </ExpandoSection>
    </SectionList>
  );
}

function ResponseTab({item}: TabProps) {
  return (
    <SectionList>
      <ExpandoSection title={t('Response Body')}>
        {objectInspectorOrNotFound(
          item.data?.response?.body,
          t('Response body not found')
        )}
      </ExpandoSection>
    </SectionList>
  );
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
  ${p => p.theme.overflowEllipsis};
  text-transform: capitalize;
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 600;
  color: ${p => p.theme.headingColor};
  background: ${p => p.theme.background};
  line-height: ${p => p.theme.text.lineHeightBody};

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

const IconWrapper = styled('span')`
  display: flex;
  align-items: center;
  margin-right: ${space(1)};
  flex-shrink: 0;
`;

const ExpandoTitle = styled('button')`
  border: 0;
  background: ${p => p.theme.background};
  color: ${p => p.theme.headingColor};

  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;

  padding: ${space(0.5)} 0;

  :hover {
    background: ${p => p.theme.backgroundSecondary};
  }
`;

function ExpandoSection({title, children}: {children: ReactNode; title: string}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Fragment>
      <SectionTitle>
        <ExpandoTitle aria-label={t('toggle section')} onClick={() => setIsOpen(!isOpen)}>
          {title}
          <IconWrapper>
            <IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />
          </IconWrapper>
        </ExpandoTitle>
      </SectionTitle>
      <SectionData>{isOpen ? children : null}</SectionData>
    </Fragment>
  );
}

const NotFoundText = styled('code')`
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

export default NetworkDetailsContent;
