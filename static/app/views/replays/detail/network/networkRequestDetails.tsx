import {MouseEvent, useCallback, useMemo} from 'react';
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
    <div data-test-id="network-request-details">
      <StyledStacked>
        <StyledNetworkRequestTabs />
        <CloseButtonWrapper>
          <Button
            aria-label={t('Hide request details')}
            borderless
            icon={<IconClose isCircled size="sm" color="subText" />}
            onClick={onClose}
            size="zero"
          />
        </CloseButtonWrapper>
        <StyledSplitDivider
          isHeld={isHeld}
          onDoubleClick={onDoubleClick}
          onMouseDown={onMouseDown}
          slideDirection="updown"
        />
      </StyledStacked>
      <ResizeableContainer height={containerSize}>
        <JSONBlock data={data} />
      </ResizeableContainer>
    </div>
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
`;

const StyledNetworkRequestTabs = styled(NetworkRequestTabs)`
  & > * {
    padding-top: ${space(1)};
  }
  & > :first-child {
    margin-left: ${space(1)};
  }
`;

const CloseButtonWrapper = styled('div')`
  display: flex;
  flex-direction: row-reverse;
  padding: ${space(1)};
`;

const StyledSplitDivider = styled(SplitDivider)`
  height: 100%;
`;

const ResizeableContainer = styled('div')<{height: number}>`
  height: ${p => p.height}px;
  padding: ${space(1)};
  overflow: scroll;
`;

export default NetworkRequestDetails;
