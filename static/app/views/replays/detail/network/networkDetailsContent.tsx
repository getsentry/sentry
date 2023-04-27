import {Fragment, MouseEvent, ReactNode, useState} from 'react';
import styled from '@emotion/styled';
import queryString from 'query-string';

import {Button} from 'sentry/components/button';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import ObjectInspector from 'sentry/components/objectInspector';
import {IconChevron, IconShow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatBytesBase10} from 'sentry/utils';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import {TabKey} from 'sentry/views/replays/detail/network/networkDetailsTabs';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';
import type {NetworkSpan} from 'sentry/views/replays/types';

type TabProps = {
  item: NetworkSpan;
  onScrollToRow: () => void;
  startTimestampMs: number;
};

function DetailsTab({item, onScrollToRow, startTimestampMs}: TabProps) {
  const {handleClick} = useCrumbHandlers(startTimestampMs);

  const startMs = item.startTimestamp * 1000;
  const endMs = item.endTimestamp * 1000;

  const data = {
    [t('URL')]: (
      <Fragment>
        {item.description}
        <Button
          aria-label={t('Scroll into view')}
          borderless
          icon={<IconShow color="gray500" size="xs" />}
          onClick={onScrollToRow}
          size="xs"
        />
      </Fragment>
    ),
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
      <SectionItem title={t('Request Headers')}>
        {keyValueTablOrNotFound(item.data.request?.headers, t('Headers not captured'))}
      </SectionItem>
      <SectionItem title={t('Response Headers')}>
        {keyValueTablOrNotFound(item.data.request?.headers, t('Headers not captured'))}
      </SectionItem>
    </SectionList>
  );
}

function RequestTab({item}: TabProps) {
  const queryParams = queryString.parse(item.description?.split('?')?.[1] ?? '');

  return (
    <SectionList>
      <SectionItem title={t('Query String Parameters')}>
        {objectInspectorOrNotFound(queryParams, t('Query Params not found'))}
      </SectionItem>
      <SectionItem title={t('Request Payload')}>
        {objectInspectorOrNotFound(item.data?.request?.body, t('Request Body not found'))}
      </SectionItem>
    </SectionList>
  );
}

function ResponseTab({item}: TabProps) {
  return (
    <SectionList>
      <SectionItem title={t('Response Body')}>
        {objectInspectorOrNotFound(
          item.data?.response?.body,
          t('Response body not found')
        )}
      </SectionItem>
    </SectionList>
  );
}

function objectInspectorOrNotFound(data: any, notFoundText: string) {
  return data ? (
    <Indent>
      <ObjectInspector data={data} expandLevel={3} />
    </Indent>
  ) : (
    <Indent>
      <NotFoundText>{notFoundText}</NotFoundText>
    </Indent>
  );
}

function keyValueTablOrNotFound(data: Record<string, string>, notFoundText: string) {
  return data ? (
    <StyledKeyValueTable noMargin>
      {Object.entries(data).map(([key, values]) => (
        <KeyValueTableRow key={key} keyName={key} value={values} />
      ))}
    </StyledKeyValueTable>
  ) : (
    <Indent>
      <NotFoundText>{notFoundText}</NotFoundText>
    </Indent>
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
`;

const SectionTitle = styled('dt')``;

const SectionData = styled('dd')`
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

const ToggleButton = styled('button')`
  background: ${p => p.theme.background};
  border: 0;
  color: ${p => p.theme.headingColor};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  line-height: ${p => p.theme.text.lineHeightBody};

  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: ${space(0.75)};

  padding: ${space(0.5)} ${space(1.5)};

  :hover {
    background: ${p => p.theme.backgroundSecondary};
  }
`;

function SectionItem({children, title}: {children: ReactNode; title: string}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Fragment>
      <SectionTitle>
        <ToggleButton aria-label={t('toggle section')} onClick={() => setIsOpen(!isOpen)}>
          <IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />
          {title}
        </ToggleButton>
      </SectionTitle>
      <SectionData>{isOpen ? children : null}</SectionData>
    </Fragment>
  );
}

const Indent = styled('div')`
  padding-left: ${space(4)};
`;

const NotFoundText = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledKeyValueTable = styled(KeyValueTable)`
  & > dt {
    font-size: ${p => p.theme.fontSizeSmall};
    padding-left: ${space(4)};
  }
  & > dd {
    ${p => p.theme.overflowEllipsis};
    font-size: ${p => p.theme.fontSizeSmall};
    display: flex;
    justify-content: flex-end;
  }
`;

export default NetworkDetailsContent;
