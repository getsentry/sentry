import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import CompactSelect from 'sentry/components/forms/compactSelect';
import {Panel} from 'sentry/components/panels';
import {BreadcrumbLevelType, BreadcrumbTypeDefault} from 'sentry/types/breadcrumbs';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

import ConsoleMessage from './consoleMessage';

interface Props {
  breadcrumbs: BreadcrumbTypeDefault[];
}

const getDistinctLogLevels = breadcrumbs =>
  Array.from(new Set(breadcrumbs.map(breadcrumb => breadcrumb.level)));

function Console({breadcrumbs}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [logLevel, setLogLevel] = useState<BreadcrumbLevelType[]>([]);
  const handleSearch = debounce(query => setSearchTerm(query), 150);
  const filteredBreadcrumbs = useMemo(
    () =>
      !searchTerm
        ? breadcrumbs
        : breadcrumbs.filter(breadcrumb =>
            breadcrumb.message?.toLowerCase().includes(searchTerm) && logLevel.includes(breadcrumb.level)
          ),
    [logLevel, searchTerm, breadcrumbs]
  );
  return (
    <Fragment>
       <CompactSelect
        triggerProps={{
          size: 'small',
          prefix: t('Log Level'),
        }}
        multiple
        options={getDistinctLogLevels(breadcrumbs).map(breadcrumbLogLevel => ({
          value: breadcrumbLogLevel,
          label: `${breadcrumbLogLevel}`,
        }))}
        onChange={selections => setLogLevel(selections.map(selection => selection.value))}
      />
      <ConsoleSearch onChange={handleSearch} />
      {filteredBreadcrumbs.length > 0 ? (
        <ConsoleTable>
          {filteredBreadcrumbs.map((breadcrumb, i) => (
            <ConsoleMessage
              key={i}
              isLast={i === breadcrumbs.length - 1}
              breadcrumb={breadcrumb}
            />
          ))}
        </ConsoleTable>
      ) : (
        <StyledEmptyMessage title={t('No results found.')} />
      )}
    </Fragment>
  );
}

const StyledEmptyMessage = styled(EmptyMessage)`
  align-items: center;
`;

const ConsoleTable = styled(Panel)`
  display: grid;
  grid-template-columns: max-content auto;
  font-family: ${p => p.theme.text.familyMono};
  font-size: 0.8em;
`;

const ConsoleSearch = styled(SearchBar)`
  margin-bottom: ${space(1)};
  margin-top: 28px;
`;

export default Console;
