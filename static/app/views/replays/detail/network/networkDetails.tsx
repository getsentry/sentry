import {Fragment, MouseEvent, useCallback} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Stacked from 'sentry/components/replays/breadcrumbs/stacked';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import useUrlParams from 'sentry/utils/useUrlParams';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import SplitDivider from 'sentry/views/replays/detail/layout/splitDivider';
import NetworkDetailsContent from 'sentry/views/replays/detail/network/networkDetailsContent';
import NetworkDetailsTabs, {
  TabKey,
} from 'sentry/views/replays/detail/network/networkDetailsTabs';
import type {NetworkSpan} from 'sentry/views/replays/types';

type Props = {
  initialHeight: number;
  items: NetworkSpan[];
  projectId: undefined | string;
  startTimestampMs: number;
};

function NetworkDetails({initialHeight, items, projectId, startTimestampMs}: Props) {
  const {getParamValue: getDetailRow, setParamValue: setDetailRow} = useUrlParams(
    'n_detail_row',
    ''
  );
  const {getParamValue: getDetailTab} = useUrlParams('n_detail_tab', 'details');
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

  const visibleTab = getDetailTab() as TabKey;

  const tab =
    item && projectId ? (
      <NetworkDetailsContent
        item={item}
        projectId={projectId}
        startTimestampMs={startTimestampMs}
        visibleTab={visibleTab}
      />
    ) : null;

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
      <FluidHeight style={{height: containerSize}}>{tab}</FluidHeight>
    </Fragment>
  );
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

export default NetworkDetails;
