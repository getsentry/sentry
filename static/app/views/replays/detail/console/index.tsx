import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import CompactSelect from 'sentry/components/forms/compactSelect';
import {Panel} from 'sentry/components/panels';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {BreadcrumbLevelType, BreadcrumbTypeDefault} from 'sentry/types/breadcrumbs';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

import ConsoleMessage from './consoleMessage';
import {filterBreadcrumbs} from './utils';

interface Props {
  breadcrumbs: BreadcrumbTypeDefault[];
  startTimestamp: number;
}

const getDistinctLogLevels = breadcrumbs =>
  Array.from(new Set<string>(breadcrumbs.map(breadcrumb => breadcrumb.level)));

function Console({breadcrumbs, startTimestamp = 0}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [logLevel, setLogLevel] = useState<BreadcrumbLevelType[]>([]);
  const handleSearch = debounce(query => setSearchTerm(query), 150);

  const filteredBreadcrumbs = useMemo(
    () => filterBreadcrumbs(breadcrumbs, searchTerm, logLevel),
    [logLevel, searchTerm, breadcrumbs]
  );

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
