import {Fragment, MouseEvent} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Stacked from 'sentry/components/replays/breadcrumbs/stacked';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';
import useUrlParams from 'sentry/utils/useUrlParams';
import SplitDivider from 'sentry/views/replays/detail/layout/splitDivider';
import NetworkDetailsContent from 'sentry/views/replays/detail/network/details/content';
import NetworkDetailsTabs, {
  TabKey,
} from 'sentry/views/replays/detail/network/details/tabs';
import type {NetworkSpan} from 'sentry/views/replays/types';

type Props = {
  isSetup: boolean;
  item: null | NetworkSpan;
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
            onClick={(e: MouseEvent) => {
              e.preventDefault();
              onClose();
            }}
            size="zero"
          />
        </CloseButtonWrapper>
      </StyledStacked>

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
    padding-right: ${space(1)};
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
