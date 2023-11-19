import {Fragment, MouseEvent} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Stacked from 'sentry/components/replays/breadcrumbs/stacked';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {HydratedA11yFrame} from 'sentry/utils/replays/hydrateA11yFrame';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import AccessibilityDetailsContent from 'sentry/views/replays/detail/accessibility/details/content';
import SplitDivider from 'sentry/views/replays/detail/layout/splitDivider';

type Props = {
  item: null | HydratedA11yFrame;
  onClose: () => void;
  projectId: undefined | string;
  startTimestampMs: number;
} & Omit<ReturnType<typeof useResizableDrawer>, 'size'>;

function AccessibilityDetails({
  isHeld,
  item,
  onClose,
  onDoubleClick,
  onMouseDown,
  projectId,
  startTimestampMs,
}: Props) {
  if (!item || !projectId) {
    return null;
  }

  return (
    <Fragment>
      <StyledStacked>
        <StyledSplitDivider
          data-is-held={isHeld}
          data-slide-direction="updown"
          onDoubleClick={onDoubleClick}
          onMouseDown={onMouseDown}
        />
        <CloseButtonWrapper>
          <Button
            aria-label={t('Hide accessibility details')}
            borderless
            icon={<IconClose isCircled size="sm" color="subText" />}
            onClick={(e: MouseEvent) => {
              e.preventDefault();
              onClose();
            }}
            size="zero"
          />
        </CloseButtonWrapper>
      </StyledStacked>

      <AccessibilityDetailsContent
        item={item}
        projectId={projectId}
        startTimestampMs={startTimestampMs}
      />
    </Fragment>
  );
}

const StyledStacked = styled(Stacked)`
  position: relative;
  border-top: 1px solid ${p => p.theme.border};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const CloseButtonWrapper = styled('div')`
  position: absolute;
  right: 0;
  height: 100%;
  padding: ${space(1)};
  z-index: ${p => p.theme.zIndex.initial};
  display: flex;
  align-items: center;
`;

const StyledSplitDivider = styled(SplitDivider)`
  padding: ${space(0.75)};

  :hover,
  &[data-is-held='true'] {
    z-index: ${p => p.theme.zIndex.initial};
  }
`;

export default AccessibilityDetails;
