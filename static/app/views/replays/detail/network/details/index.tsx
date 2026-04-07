import {Fragment} from 'react';
import {useQueryState} from 'nuqs';

import {DetailsSplitDivider} from 'sentry/components/replays/virtualizedGrid/detailsSplitDivider';
import type {SpanFrame} from 'sentry/utils/replays/types';
import type {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import {NetworkDetailsContent} from 'sentry/views/replays/detail/network/details/content';
import {
  networkDetailsTabParser,
  StyledNetworkDetailsTabs as NetworkDetailsTabs,
} from 'sentry/views/replays/detail/network/details/tabs';

type Props = {
  isCaptureBodySetup: boolean;
  isSetup: boolean;
  item: null | SpanFrame;
  onClose: () => void;
  projectId: undefined | string;
  startTimestampMs: number;
} & Omit<ReturnType<typeof useResizableDrawer>, 'size'>;

export function NetworkDetails({
  isHeld,
  isSetup,
  isCaptureBodySetup,
  item,
  onClose,
  onDoubleClick,
  onMouseDown,
  projectId,
  startTimestampMs,
}: Props) {
  const [visibleTab] = useQueryState('n_detail_tab', networkDetailsTabParser);

  if (!item || !projectId) {
    return null;
  }

  return (
    <Fragment>
      <DetailsSplitDivider
        isHeld={isHeld}
        onClose={onClose}
        onDoubleClick={onDoubleClick}
        onMouseDown={onMouseDown}
      >
        <NetworkDetailsTabs />
      </DetailsSplitDivider>

      <NetworkDetailsContent
        isSetup={isSetup}
        isCaptureBodySetup={isCaptureBodySetup}
        item={item}
        projectId={projectId}
        startTimestampMs={startTimestampMs}
        visibleTab={visibleTab}
      />
    </Fragment>
  );
}
