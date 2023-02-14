import {useRef} from 'react';
import styled from '@emotion/styled';

import {
  Panel as BasePanel,
  PanelHeader as BasePanelHeader,
} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getPrevReplayEvent} from 'sentry/utils/replays/getReplayEvent';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import {useCurrentItemScroller} from 'sentry/utils/replays/hooks/useCurrentItemScroller';
import BreadcrumbItem from 'sentry/views/replays/detail/breadcrumbs/breadcrumbItem';
import FluidPanel from 'sentry/views/replays/detail/layout/fluidPanel';

function CrumbPlaceholder({number}: {number: number}) {
  return (
    <BreadcrumbContainer>
      {[...Array(number)].map((_, i) => (
        <PlaceholderMargin key={i} height="53px" />
      ))}
    </BreadcrumbContainer>
  );
}

type Props = {
  showTitle: boolean;
};

function Breadcrumbs({showTitle = true}: Props) {
  const {currentHoverTime, currentTime, replay} = useReplayContext();

  const replayRecord = replay?.getReplay();
  const allCrumbs = replay?.getRawCrumbs();

  const crumbListContainerRef = useRef<HTMLDivElement>(null);
  useCurrentItemScroller(crumbListContainerRef);

  const startTimestampMs = replayRecord?.started_at.getTime() || 0;
  const {handleMouseEnter, handleMouseLeave, handleClick} =
    useCrumbHandlers(startTimestampMs);

  const isLoaded = Boolean(replayRecord);

  const crumbs =
    allCrumbs?.filter(crumb => !['console'].includes(crumb.category || '')) || [];

  const currentUserAction = getPrevReplayEvent({
    items: crumbs,
    targetTimestampMs: startTimestampMs + currentTime,
    allowExact: true,
  });

  const closestUserAction =
    currentHoverTime !== undefined
      ? getPrevReplayEvent({
          items: crumbs,
          targetTimestampMs: startTimestampMs + (currentHoverTime ?? 0),
          allowExact: true,
        })
      : undefined;

  const content = isLoaded ? (
    <BreadcrumbContainer>
      {crumbs.map(crumb => (
        <BreadcrumbItem
          key={crumb.id}
          crumb={crumb}
          startTimestampMs={startTimestampMs}
          isHovered={closestUserAction?.id === crumb.id}
          isSelected={currentUserAction?.id === crumb.id}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          // We are controlling the hover state ourselves with `isHovered` prop
          allowHover={false}
        />
      ))}
    </BreadcrumbContainer>
  ) : (
    <CrumbPlaceholder number={4} />
  );

  return (
    <Panel>
      <FluidPanel
        bodyRef={crumbListContainerRef}
        title={showTitle ? <PanelHeader>{t('Breadcrumbs')}</PanelHeader> : undefined}
      >
        {content}
      </FluidPanel>
    </Panel>
  );
}

const BreadcrumbContainer = styled('div')`
  padding: ${space(0.5)};
`;

const Panel = styled(BasePanel)`
  width: 100%;
  height: 100%;
  overflow: hidden;
  margin-bottom: 0;
`;

const PanelHeader = styled(BasePanelHeader)`
  background-color: ${p => p.theme.background};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray500};
  text-transform: capitalize;
  padding: ${space(1)} ${space(1.5)} ${space(1)};
  font-weight: 600;
`;

const PlaceholderMargin = styled(Placeholder)`
  margin-bottom: ${space(1)};
  width: auto;
  border-radius: ${p => p.theme.borderRadius};
`;

export default Breadcrumbs;
