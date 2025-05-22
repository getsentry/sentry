import {Fragment} from 'react';

import DetailsSplitDivider from 'sentry/components/replays/virtualizedGrid/detailsSplitDivider';
import type {SpanFrame} from 'sentry/utils/replays/types';
import type {UseResizableDrawerResult} from 'sentry/utils/useResizableDrawer';
import useUrlParams from 'sentry/utils/useUrlParams';
import NetworkDetailsContent from 'sentry/views/replays/detail/network/details/content';
import type {TabKey} from 'sentry/views/replays/detail/network/details/tabs';
import NetworkDetailsTabs from 'sentry/views/replays/detail/network/details/tabs';

type Props = {
  isCaptureBodySetup: boolean;
  isSetup: boolean;
  item: null | SpanFrame;
  onClose: () => void;
  onDoubleClick: () => void;
  projectId: undefined | string;
  resizeProps: UseResizableDrawerResult;
  startTimestampMs: number;
};

function NetworkDetails({
  isSetup,
  isCaptureBodySetup,
  item,
  onClose,
  onDoubleClick,
  resizeProps,
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
        onClose={onClose}
        onDoubleClick={onDoubleClick}
        resizeProps={resizeProps}
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

export default NetworkDetails;
