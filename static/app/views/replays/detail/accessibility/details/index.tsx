import {Fragment, MouseEvent} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Stacked from 'sentry/components/replays/breadcrumbs/stacked';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SpanFrame} from 'sentry/utils/replays/types';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import AccessibilityDetailsContent from 'sentry/views/replays/detail/accessibility/details/content';
import SplitDivider from 'sentry/views/replays/detail/layout/splitDivider';

type Props = {
  item: null | SpanFrame;
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

const StyledSplitDivider = styled(SplitDivider)<{isHeld: boolean}>`
  height: 100%;
  ${p => (p.isHeld ? `z-index: ${p.theme.zIndex.initial + 1};` : '')}
  :hover {
    z-index: ${p => p.theme.zIndex.initial + 1};
  }
`;

export default AccessibilityDetails;
