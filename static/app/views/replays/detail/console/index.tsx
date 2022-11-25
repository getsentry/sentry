import {useCallback, useRef} from 'react';
import styled from '@emotion/styled';

import CompactSelect from 'sentry/components/compactSelect';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {Panel} from 'sentry/components/panels';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import type {BreadcrumbTypeDefault, Crumb} from 'sentry/types/breadcrumbs';
import {defined} from 'sentry/utils';
import {getPrevReplayEvent} from 'sentry/utils/replays/getReplayEvent';
import {useCurrentItemScroller} from 'sentry/utils/replays/hooks/useCurrentItemScroller';
import ConsoleMessage from 'sentry/views/replays/detail/console/consoleMessage';
import useConsoleFilters from 'sentry/views/replays/detail/console/useConsoleFilters';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

interface Props {
  breadcrumbs: Extract<Crumb, BreadcrumbTypeDefault>[];
  startTimestampMs: number;
}

function Console({breadcrumbs, startTimestampMs = 0}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  useCurrentItemScroller(containerRef);

  const {items, logLevel, searchTerm, getOptions, setLogLevel, setSearchTerm} =
    useConsoleFilters({
      breadcrumbs,
    });

  return (
    <ConsoleContainer>
      <ConsoleFilters>
        <CompactSelect
          triggerProps={{prefix: t('Log Level')}}
          triggerLabel={logLevel.length === 0 ? t('Any') : null}
          multiple
          options={getOptions()}
          onChange={selected => setLogLevel(selected.map(_ => _.value))}
          size="sm"
          value={logLevel}
        />
        <SearchBar
          onChange={setSearchTerm}
          placeholder={t('Search console logs...')}
          size="sm"
          query={searchTerm}
        />
      </ConsoleFilters>
      <ConsoleMessageContainer ref={containerRef}>
        <ConsoleContent
          breadcrumbs={breadcrumbs}
          items={items}
          startTimestampMs={startTimestampMs}
        />
      </ConsoleMessageContainer>
    </ConsoleContainer>
  );
}

type ContentProps = {
  breadcrumbs: Extract<Crumb, BreadcrumbTypeDefault>[];
  items: Extract<Crumb, BreadcrumbTypeDefault>[];
  startTimestampMs: number;
};

function ConsoleContent({items, breadcrumbs, startTimestampMs}: ContentProps) {
  const {currentHoverTime, currentTime} = useReplayContext();

  const currentUserAction = getPrevReplayEvent({
    items,
    targetTimestampMs: startTimestampMs + currentTime,
    allowExact: true,
    allowEqual: true,
  });

  const closestUserAction =
    currentHoverTime !== undefined
      ? getPrevReplayEvent({
          items,
          targetTimestampMs: startTimestampMs + (currentHoverTime ?? 0),
          allowExact: true,
          allowEqual: true,
        })
      : undefined;

  const isOcurring = useCallback(
    (breadcrumb: Crumb, closestBreadcrumb?: Crumb): boolean => {
      if (!defined(currentHoverTime) || !defined(closestBreadcrumb)) {
        return false;
      }

      const isCurrentBreadcrumb = closestBreadcrumb.id === breadcrumb.id;

      // We don't want to hightlight the breadcrumb if it's more than 1 second away from the current hover time
      const isMoreThanASecondOfDiff =
        Math.trunc(currentHoverTime / 1000) >
        Math.trunc(
          relativeTimeInMs(closestBreadcrumb.timestamp || '', startTimestampMs) / 1000
        );

      return isCurrentBreadcrumb && !isMoreThanASecondOfDiff;
    },
    [startTimestampMs, currentHoverTime]
  );

  if (breadcrumbs.length === 0) {
    return (
      <EmptyStateWarning withIcon={false} small>
        {t('No console messages recorded')}
      </EmptyStateWarning>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyStateWarning withIcon small>
        {t('No results found')}
      </EmptyStateWarning>
    );
  }
  return (
    <ConsoleTable>
      {items.map((breadcrumb, i) => {
        return (
          <ConsoleMessage
            isActive={closestUserAction?.id === breadcrumb.id}
            isCurrent={currentUserAction?.id === breadcrumb.id}
            isOcurring={isOcurring(breadcrumb, closestUserAction)}
            startTimestampMs={startTimestampMs}
            key={breadcrumb.id}
            isLast={i === breadcrumbs.length - 1}
            breadcrumb={breadcrumb}
            hasOccurred={
              currentTime >=
              relativeTimeInMs(breadcrumb?.timestamp || '', startTimestampMs)
            }
          />
        );
      })}
    </ConsoleTable>
  );
}

const ConsoleContainer = styled(FluidHeight)`
  height: 100%;
`;

const ConsoleFilters = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: max-content 1fr;
  margin-bottom: ${space(1)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    margin-top: ${space(1)};
  }
`;

const ConsoleMessageContainer = styled(FluidHeight)`
  overflow: auto;
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  box-shadow: ${p => p.theme.dropShadowLight};
`;

const ConsoleTable = styled(Panel)`
  display: grid;
  grid-template-columns: max-content auto max-content;
  width: 100%;
  font-family: ${p => p.theme.text.familyMono};
  font-size: 0.8em;
  border: none;
  box-shadow: none;
  margin-bottom: 0;
`;

export default Console;
