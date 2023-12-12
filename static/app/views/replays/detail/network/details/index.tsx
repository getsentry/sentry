import {Fragment} from 'react';

import DetailsSplitDivider from 'sentry/components/replays/virtualizedGrid/detailsSplitDivider';
import type {SpanFrame} from 'sentry/utils/replays/types';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import useUrlParams from 'sentry/utils/useUrlParams';
import NetworkDetailsContent from 'sentry/views/replays/detail/network/details/content';
import NetworkDetailsTabs, {
  TabKey,
} from 'sentry/views/replays/detail/network/details/tabs';

type Props = {
  isSetup: boolean;
  item: null | SpanFrame;
  onClose: () => void;
  projectId: undefined | string;
  startTimestampMs: number;
} & Omit<ReturnType<typeof useResizableDrawer>, 'size'>;

function NetworkDetails({
  isHeld,
  isSetup,
  item,
  onClose,
  onDoubleClick,
  onMouseDown,
  projectId,
  startTimestampMs,
}: Props) {
  const {getParamValue: getDetailTab} = useUrlParams('n_detail_tab', 'details');

  if (!item || !projectId) {
    return null;
  }

  const visibleTab = getDetailTab() as TabKey;

  return (
    <Fragment>
      <DetailsSplitDivider
        isHeld={isHeld}
        onClose={onClose}
        onDoubleClick={onDoubleClick}
        onMouseDown={onMouseDown}
      >
        <NetworkDetailsTabs underlined={false} />
      </DetailsSplitDivider>

      <NetworkDetailsContent
        isSetup={isSetup}
        item={item}
        projectId={projectId}
        startTimestampMs={startTimestampMs}
        visibleTab={visibleTab}
      />
    </Fragment>
  );
}

export default NetworkDetails;
