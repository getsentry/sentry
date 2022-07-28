import {useCallback, useRef} from 'react';
import styled from '@emotion/styled';

import {
  Panel as BasePanel,
  PanelHeader as BasePanelHeader,
} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Crumb} from 'sentry/types/breadcrumbs';
import {getPrevBreadcrumb} from 'sentry/utils/replays/getBreadcrumb';
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

type Props = {};

function Breadcrumbs({}: Props) {
  const {
    clearAllHighlights,
    currentHoverTime,
    currentTime,
    highlight,
    removeHighlight,
    replay,
    setCurrentHoverTime,
    setCurrentTime,
  } = useReplayContext();

  const replayRecord = replay?.getReplay();
  const allCrumbs = replay?.getRawCrumbs();

  const crumbListContainerRef = useRef<HTMLDivElement>(null);
  useCurrentItemScroller(crumbListContainerRef);

  const startTimestampMS = replayRecord?.started_at.getDate() || 0;

  const isLoaded = Boolean(replayRecord);

  const crumbs =
    allCrumbs?.filter(crumb => !['console'].includes(crumb.category || '')) || [];

  const currentUserAction = getPrevBreadcrumb({
    crumbs,
    targetTimestampMs: startTimestampMS + currentTime,
    allowExact: true,
  });

  const closestUserAction =
    currentHoverTime !== undefined
      ? getPrevBreadcrumb({
          crumbs,
          targetTimestampMs: startTimestampMS + (currentHoverTime ?? 0),
          allowExact: true,
        })
      : undefined;

  const handleMouseEnter = useCallback(
    (item: Crumb) => {
      if (startTimestampMS) {
        setCurrentHoverTime(relativeTimeInMs(item.timestamp ?? '', startTimestampMS));
      }

      if (item.data && 'nodeId' in item.data) {
        // XXX: Kind of hacky, but mouseLeave does not fire if you move from a
        // crumb to a tooltip
        clearAllHighlights();
        highlight({nodeId: item.data.nodeId, annotation: item.data.label});
      }
    },
    [setCurrentHoverTime, startTimestampMS, highlight, clearAllHighlights]
  );

  const handleMouseLeave = useCallback(
    (item: Crumb) => {
      setCurrentHoverTime(undefined);

      if (item.data && 'nodeId' in item.data) {
        removeHighlight({nodeId: item.data.nodeId});
      }
    },
    [setCurrentHoverTime, removeHighlight]
  );

  const handleClick = useCallback(
    (crumb: Crumb) => {
      crumb.timestamp !== undefined
        ? setCurrentTime(relativeTimeInMs(crumb.timestamp, startTimestampMS))
        : null;
    },
    [setCurrentTime, startTimestampMS]
  );

  const content = isLoaded ? (
    <BreadcrumbContainer>
      {crumbs.map(crumb => (
        <BreadcrumbItem
          key={crumb.id}
          crumb={crumb}
          startTimestampMS={startTimestampMS}
          isHovered={closestUserAction?.id === crumb.id}
          isSelected={currentUserAction?.id === crumb.id}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
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
        title={<PanelHeader>{t('Breadcrumbs')}</PanelHeader>}
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
