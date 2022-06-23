import {Fragment, useCallback, useRef} from 'react';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import space from 'sentry/styles/space';
import {Crumb} from 'sentry/types/breadcrumbs';
import {EventTransaction} from 'sentry/types/event';
import {getPrevBreadcrumb} from 'sentry/utils/replays/getBreadcrumb';
import {useCurrentItemScroller} from 'sentry/utils/replays/hooks/useCurrentItemScroller';

import BreadcrumbItem from './breadcrumbItem';

function CrumbPlaceholder({number}: {number: number}) {
  return (
    <Fragment>
      {[...Array(number)].map((_, i) => (
        <PlaceholderMargin key={i} height="40px" />
      ))}
    </Fragment>
  );
}

type Props = {
  /**
   * Raw breadcrumbs, `undefined` means it is still loading
   */
  crumbs: Crumb[] | undefined;
  /**
   * Root replay event, `undefined` means it is still loading
   */
  event: EventTransaction | undefined;
};

function Breadcrumbs({event, crumbs: allCrumbs}: Props) {
  const {
    setCurrentTime,
    setCurrentHoverTime,
    currentHoverTime,
    currentTime,
    highlight,
    removeHighlight,
    clearAllHighlights,
  } = useReplayContext();

  const crumbListContainerRef = useRef<HTMLDivElement>(null);
  useCurrentItemScroller(crumbListContainerRef);

  const startTimestamp = event?.startTimestamp || 0;

  const isLoaded = Boolean(event);

  const crumbs =
    allCrumbs?.filter(crumb => !['console'].includes(crumb.category || '')) || [];

  const currentUserAction = getPrevBreadcrumb({
    crumbs,
    targetTimestampMs: startTimestamp * 1000 + currentTime,
    allowExact: true,
  });

  const closestUserAction =
    currentHoverTime !== undefined
      ? getPrevBreadcrumb({
          crumbs,
          targetTimestampMs: startTimestamp * 1000 + (currentHoverTime ?? 0),
          allowExact: true,
        })
      : undefined;

  const handleMouseEnter = useCallback(
    (item: Crumb) => {
      if (startTimestamp) {
        setCurrentHoverTime(relativeTimeInMs(item.timestamp ?? '', startTimestamp));
      }

      if (item.data && 'nodeId' in item.data) {
        // XXX: Kind of hacky, but mouseLeave does not fire if you move from a
        // crumb to a tooltip
        clearAllHighlights();
        highlight({nodeId: item.data.nodeId});
      }
    },
    [setCurrentHoverTime, startTimestamp, highlight, clearAllHighlights]
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
        ? setCurrentTime(relativeTimeInMs(crumb.timestamp, startTimestamp))
        : null;
    },
    [setCurrentTime, startTimestamp]
  );

  return (
    <BreadcrumbList ref={crumbListContainerRef}>
      {!isLoaded && <CrumbPlaceholder number={4} />}
      {isLoaded &&
        crumbs.map(crumb => (
          <BreadcrumbItem
            key={crumb.id}
            crumb={crumb}
            startTimestamp={startTimestamp}
            isHovered={closestUserAction?.id === crumb.id}
            isSelected={currentUserAction?.id === crumb.id}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
          />
        ))}
    </BreadcrumbList>
  );
}

const BreadcrumbList = styled('div')`
  overflow-y: auto;
  max-height: 100%;
`;

const PlaceholderMargin = styled(Placeholder)`
  margin: ${space(1)} ${space(1.5)};
  width: auto;
`;

export default Breadcrumbs;
