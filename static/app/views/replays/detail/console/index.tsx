import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import CompactSelect from 'sentry/components/forms/compactSelect';
import {Panel} from 'sentry/components/panels';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs, showPlayerTime} from 'sentry/components/replays/utils';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import type {BreadcrumbLevelType, BreadcrumbTypeDefault} from 'sentry/types/breadcrumbs';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

import ConsoleMessage from './consoleMessage';
import {filterBreadcrumbs} from './utils';

interface Props {
  breadcrumbs: BreadcrumbTypeDefault[];
  startTimestamp: number;
}

const getDistinctLogLevels = (breadcrumbs: BreadcrumbTypeDefault[]) =>
  Array.from(new Set<string>(breadcrumbs.map(breadcrumb => breadcrumb.level)));

function Console({breadcrumbs, startTimestamp = 0}: Props) {
  const {currentHoverTime} = useReplayContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [logLevel, setLogLevel] = useState<BreadcrumbLevelType[]>([]);
  const handleSearch = debounce(query => setSearchTerm(query), 150);

  const filteredBreadcrumbs = useMemo(
    () => filterBreadcrumbs(breadcrumbs, searchTerm, logLevel),
    [logLevel, searchTerm, breadcrumbs]
  );

  const activeConsoleBounds = useMemo(() => {
    if (filteredBreadcrumbs.length <= 0 || currentHoverTime === undefined) {
      return [-1, -1];
    }

    let indexUpperBound = 0;
    const finalBreadCrumbIndex = filteredBreadcrumbs.length - 1;
    const finalBreadcrumbTimestamp =
      filteredBreadcrumbs[finalBreadCrumbIndex].timestamp || '';

    if (currentHoverTime >= relativeTimeInMs(finalBreadcrumbTimestamp, startTimestamp)) {
      indexUpperBound = finalBreadCrumbIndex;
    } else {
      indexUpperBound =
        filteredBreadcrumbs.findIndex(
          breadcrumb =>
            relativeTimeInMs(breadcrumb.timestamp || '', startTimestamp) >=
            (currentHoverTime || 0)
        ) - 1;
    }

    const activeMessageBoundary = showPlayerTime(
      filteredBreadcrumbs[indexUpperBound]?.timestamp || '',
      startTimestamp
    );

    const indexLowerBound = filteredBreadcrumbs.findIndex(
      breadcrumb =>
        showPlayerTime(breadcrumb.timestamp || '', startTimestamp) ===
        activeMessageBoundary
    );

    return [indexLowerBound, indexUpperBound];
  }, [currentHoverTime, filteredBreadcrumbs, startTimestamp]);

  return (
    <Fragment>
      <ConsoleFilters>
        <CompactSelect
          triggerProps={{
            prefix: t('Log Level'),
          }}
          multiple
          options={getDistinctLogLevels(breadcrumbs).map(breadcrumbLogLevel => ({
            value: breadcrumbLogLevel,
            label: breadcrumbLogLevel,
          }))}
          onChange={selections =>
            setLogLevel(selections.map(selection => selection.value))
          }
        />
        <SearchBar onChange={handleSearch} placeholder={t('Search console logs...')} />
      </ConsoleFilters>

      {filteredBreadcrumbs.length > 0 ? (
        <ConsoleTable>
          {filteredBreadcrumbs.map((breadcrumb, i) => {
            return (
              <ConsoleMessage
                isActive={i >= activeConsoleBounds[0] && i <= activeConsoleBounds[1]}
                startTimestamp={startTimestamp}
                key={i}
                isLast={i === breadcrumbs.length - 1}
                breadcrumb={breadcrumb}
              />
            );
          })}
        </ConsoleTable>
      ) : (
        <StyledEmptyMessage title={t('No results found.')} />
      )}
    </Fragment>
  );
}

const ConsoleFilters = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: max-content 1fr;
  margin-bottom: ${space(1)};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    margin-top: ${space(1)};
  }
`;

const StyledEmptyMessage = styled(EmptyMessage)`
  align-items: center;
`;

const ConsoleTable = styled(Panel)`
  display: grid;
  grid-template-columns: max-content auto max-content;
  width: 100%;
  font-family: ${p => p.theme.text.familyMono};
  font-size: 0.8em;
`;

export default Console;
