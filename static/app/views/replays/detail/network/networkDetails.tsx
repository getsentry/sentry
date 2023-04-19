import {Fragment, MouseEvent, ReactNode, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import queryString from 'query-string';

import {Button} from 'sentry/components/button';
import {KeyValueTable} from 'sentry/components/keyValueTable';
import ObjectInspector from 'sentry/components/objectInspector';
import Stacked from 'sentry/components/replays/breadcrumbs/stacked';
import ReplayTagsTableRow from 'sentry/components/replays/replayTagsTableRow';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatBytesBase10} from 'sentry/utils';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import useUrlParams from 'sentry/utils/useUrlParams';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import FluidPanel from 'sentry/views/replays/detail/layout/fluidPanel';
import SplitDivider from 'sentry/views/replays/detail/layout/splitDivider';
import NetworkDetailsTabs, {
  TabKey,
} from 'sentry/views/replays/detail/network/networkDetailsTabs';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';
import type {NetworkSpan} from 'sentry/views/replays/types';

type Props = {
  initialHeight: number;
  items: NetworkSpan[];
  startTimestampMs: number;
};

function NetworkRequestDetails({initialHeight, items, startTimestampMs}: Props) {
  const {getParamValue: getDetailRow, setParamValue: setDetailRow} = useUrlParams(
    'n_detail_row',
    ''
  );
  const {getParamValue: getDetailTab} = useUrlParams('n_detail_tab', 'request');
  const itemIndex = getDetailRow();

  const item = itemIndex ? (items[itemIndex] as NetworkSpan) : null;

  // TODO(replay): the `useResizableDrawer` seems to measure mouse position in relation
  // to the window with event.clientX and event.clientY
  // We should be able to pass in another frame of reference so mouse movement
  // is relative to some container instead.
  const {
    isHeld,
    onDoubleClick,
    onMouseDown,
    size: containerSize,
  } = useResizableDrawer({
    direction: 'up',
    initialSize: initialHeight,
    min: 0,
    onResize: () => {},
  });

  const onClose = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      setDetailRow('');
    },
    [setDetailRow]
  );

  const data = useMemo(() => getData(item, startTimestampMs), [item, startTimestampMs]);
  if (!data) {
    return null;
  }

  const visibleTab = getDetailTab();
  const sections = data[visibleTab] ?? data.request;

  return (
    <Fragment>
      <StyledStacked>
        <StyledNetworkDetailsTabs underlined={false} />
        <StyledSplitDivider
          isHeld={isHeld}
          onDoubleClick={onDoubleClick}
          onMouseDown={onMouseDown}
          slideDirection="updown"
        />
        <CloseButtonWrapper>
          <Button
            aria-label={t('Hide request details')}
            borderless
            icon={<IconClose isCircled size="sm" color="subText" />}
            onClick={onClose}
            size="zero"
          />
        </CloseButtonWrapper>
      </StyledStacked>
      {visibleTab === 'general' ? (
        <KeyValueSections containerSize={containerSize} sections={sections} />
      ) : (
        <ObjectSections containerSize={containerSize} sections={sections} />
      )}
    </Fragment>
  );
}

type SectionsProps = {
  containerSize: number;
  sections: Record<string, any>;
};

function KeyValueSections({containerSize, sections}: SectionsProps) {
  return (
    <FluidHeight style={{height: containerSize}}>
      <FluidPanel>
        <KeyValueTable noMargin>
          {Object.entries(sections).map(([key, values]) => (
            <ReplayTagsTableRow key={key} name={key} values={[values]} />
          ))}
        </KeyValueTable>
      </FluidPanel>
    </FluidHeight>
  );
}

function ObjectSections({containerSize, sections}: SectionsProps) {
  return (
    <SectionList height={containerSize}>
      {Object.entries(sections).map(([label, sectionData]) => (
        <Fragment key={label}>
          <SectionTitle>{label}</SectionTitle>
          <SectionData>{sectionData}</SectionData>
        </Fragment>
      ))}
    </SectionList>
  );
}
function getData(
  span: NetworkSpan | null,
  startTimestampMs: number
): undefined | Record<TabKey, Record<string, ReactNode>> {
  if (!span) {
    return undefined;
  }

  const queryParams = queryString.parse(span.description?.split('?')?.[1] ?? '');

  const startMs = span.startTimestamp * 1000;
  const endMs = span.endTimestamp * 1000;

  return {
    // It would be better if the General tab rendered in a grid, like tags
    general: {
      [t('URL')]: span.description,
      [t('Type')]: span.op,
      [t('Method')]: span.data.method,
      [t('Status Code')]: span.data.statusCode,
      [t('Request Body Size')]: formatBytesBase10(span.data.request?.size ?? 0),
      [t('Response Body Size')]: formatBytesBase10(span.data.response?.size ?? 0),
      [t('Duration')]: `${(endMs - startMs).toFixed(2)}ms`,
      [t('Timestamp')]: (
        <TimestampButton
          format="mm:ss.SSS"
          onClick={(event: MouseEvent) => {
            event.stopPropagation();
            // handleClick(span);
          }}
          startTimestampMs={startTimestampMs}
          timestampMs={startMs}
        />
      ),
    },
    request: {
      [t('Query String Parameters')]: queryParams ? (
        <ObjectInspector data={queryParams} expandLevel={3} />
      ) : (
        <NotFoundText>{t('Query Params not found')}</NotFoundText>
      ),
      [t('Request Payload')]: span.data?.request?.body ? (
        <ObjectInspector data={span.data?.request?.body} expandLevel={3} />
      ) : (
        <NotFoundText>{t('Request Body not found')}</NotFoundText>
      ),
    },
    response: {
      [t('Response Body')]: span.data?.response?.body ? (
        <ObjectInspector data={span.data?.response?.body} expandLevel={3} />
      ) : (
        <NotFoundText>{t('Response body not found')}</NotFoundText>
      ),
    },
  };
}

const StyledStacked = styled(Stacked)`
  position: relative;
  border-top: 1px solid ${p => p.theme.border};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const StyledNetworkDetailsTabs = styled(NetworkDetailsTabs)`
  /*
  Use padding instead of margin so all the <li> will cover the <SplitDivider>
  without taking 100% width.
  */

  & > li {
    margin-right: 0;
    padding-right: ${space(3)};
    background: ${p => p.theme.surface400};
    z-index: ${p => p.theme.zIndex.initial};
  }
  & > li:first-child {
    padding-left: ${space(2)};
  }
  & > li:last-child {
    padding-right: 0;
  }

  & > li > a {
    padding-top: ${space(1)};
    padding-bottom: ${space(0.5)};
    height: 100%;
    border-bottom: ${space(0.5)} solid transparent;
  }
`;

const CloseButtonWrapper = styled('div')`
  position: absolute;
  right: 0;
  height: 100%;
  padding: ${space(1)};
  z-index: ${p => p.theme.zIndex.initial};
`;

const StyledSplitDivider = styled(SplitDivider)<{isHeld: boolean}>`
  height: 100%;
  ${p => (p.isHeld ? `z-index: ${p.theme.zIndex.initial + 1};` : '')}
  :hover {
    z-index: ${p => p.theme.zIndex.initial + 1};
  }
`;

const SectionList = styled('dl')<{height: number}>`
  margin: 0;
  height: ${p => p.height}px;
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
  margin-bottom: ${space(2)};
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

const NotFoundText = styled('code')``;

export default NetworkRequestDetails;
