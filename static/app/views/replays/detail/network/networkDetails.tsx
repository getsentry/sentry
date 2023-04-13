import {Fragment, MouseEvent, useCallback, useMemo} from 'react';
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
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import useUrlParams from 'sentry/utils/useUrlParams';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import FluidPanel from 'sentry/views/replays/detail/layout/fluidPanel';
import SplitDivider from 'sentry/views/replays/detail/layout/splitDivider';
import NetworkDetailsTabs, {
  TabKey,
} from 'sentry/views/replays/detail/network/networkDetailsTabs';
import type {NetworkSpan} from 'sentry/views/replays/types';

type Props = {
  items: NetworkSpan[];
  initialHeight?: number;
};

function NetworkRequestDetails({initialHeight = 100, items}: Props) {
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

  const data = useMemo(() => getData(item), [item]);
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
            <ReplayTagsTableRow key={key} name={key} values={[String(values)]} />
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
          <SectionData>
            <ObjectInspector expandPaths={[]} data={sectionData} />
          </SectionData>
        </Fragment>
      ))}
    </SectionList>
  );
}
function getData(
  span: NetworkSpan | null
): undefined | Record<TabKey, Record<string, unknown>> {
  if (!span) {
    return undefined;
  }

  const queryParams = queryString.parse(span.description?.split('?')?.[1] ?? '');

  return {
    // It would be better if the General tab rendered in a grid, like tags
    general: {
      [t('URL')]: span.description,
      [t('Method')]: span.data.method,
      [t('Status Code')]: span.data.statusCode,
      [t('Request Body Size')]: span.data.request?.size ?? 0,
      [t('Response Body Size')]: span.data.response?.size ?? 0,
    },
    request: {
      [t('Query String Parameters')]: queryParams,
      [t('Request Payload')]: span.data?.request?.body,
    },
    response: {
      [t('Response Body')]: span.data?.response?.body,
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
`;

export default NetworkRequestDetails;
