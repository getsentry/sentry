import {Fragment} from 'react';

import DetailsSplitDivider from 'sentry/components/replays/virtualizedGrid/detailsSplitDivider';
import type {HydratedA11yFrame} from 'sentry/utils/replays/hydrateA11yFrame';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import AccessibilityDetailsContent from 'sentry/views/replays/detail/accessibility/details/content';

type Props = {
  item: null | HydratedA11yFrame;
  onClose: () => void;
} & Omit<ReturnType<typeof useResizableDrawer>, 'size'>;

function AccessibilityDetails({
  isHeld,
  item,
  onClose,
  onDoubleClick,
  onMouseDown,
}: Props) {
  if (!item) {
    return null;
  }

  return (
    <Fragment>
      <DetailsSplitDivider
        isHeld={isHeld}
        onClose={onClose}
        onDoubleClick={onDoubleClick}
        onMouseDown={onMouseDown}
      />

      <AccessibilityDetailsContent item={item} />
    </Fragment>
  );
}

export default AccessibilityDetails;
