import {Fragment, MouseEvent, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import JSONBlock from 'sentry/components/jsonBlock';
import Stacked from 'sentry/components/replays/breadcrumbs/stacked';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import useUrlParams from 'sentry/utils/useUrlParams';
import SplitDivider from 'sentry/views/replays/detail/layout/splitDivider';
import NetworkRequestTabs from 'sentry/views/replays/detail/network/networkRequestTabs';
import type {NetworkSpan} from 'sentry/views/replays/types';

type Props = {
  items: NetworkSpan[];
};

function NetworkRequestDetails({items}: Props) {
  const {getParamValue: getDetailRow, setParamValue: setDetailRow} = useUrlParams(
    'n_detail_row',
    ''
  );
  const {getParamValue: getDetailTab} = useUrlParams('n_details_tab', '');
  const itemIndex = getDetailRow();

  const item = itemIndex ? (items[itemIndex] as NetworkSpan) : null;

  const {
    isHeld,
    onDoubleClick,
    onMouseDown,
    size: containerSize,
  } = useResizableDrawer({
    direction: 'up',
    initialSize: 100,
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

  const visibleTab = getDetailTab();
  const data = useMemo(() => {
    return getDataForVisibleTab(item, visibleTab);
  }, [item, visibleTab]);

  if (!data) {
    return null;
  }

  return (
    <Fragment>
      <StyledStacked>
        <StyledNetworkRequestTabs underlined={false} />
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
      <ResizeableContainer height={containerSize}>
        <JSONBlock data={data ?? {}} />
      </ResizeableContainer>
    </Fragment>
  );
}

function getDataForVisibleTab(item: NetworkSpan | null, tab: string) {
  if (!item) {
    return null;
  }

  const empty = item; // TODO: change this to the empty object in production
  switch (tab) {
    case 'request':
      return item.data?.request?.body ?? empty;
    case 'response':
      return item.data?.response?.body ?? empty;
    case 'headers':
    default:
      return {
        request: item.data?.request?.headers ?? empty,
        response: item.data?.response?.headers ?? empty,
      };
  }
}

const StyledStacked = styled(Stacked)`
  position: relative;
  border-top: 1px solid ${p => p.theme.border};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const StyledNetworkRequestTabs = styled(NetworkRequestTabs)`
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

const ResizeableContainer = styled('div')<{height: number}>`
  height: ${p => p.height}px;
  padding: ${space(1)};
  overflow: scroll;
`;

export default NetworkRequestDetails;
