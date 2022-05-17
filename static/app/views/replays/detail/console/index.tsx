import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Panel} from 'sentry/components/panels';
import SearchBar from 'sentry/components/searchBar';
import space from 'sentry/styles/space';
import {BreadcrumbTypeDefault} from 'sentry/types/breadcrumbs';

import ConsoleMessage from './consoleMessage';

interface Props {
  breadcrumbs: BreadcrumbTypeDefault[];
}

function Console({breadcrumbs}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const handleSearch = debounce(query => setSearchTerm(query), 150);
  const filteredBreadcrumbs = useMemo(
    () =>
      !searchTerm
        ? breadcrumbs
        : breadcrumbs.filter(breadcrumb =>
            breadcrumb.message?.toLowerCase().includes(searchTerm)
          ),
    [searchTerm, breadcrumbs]
  );
  return (
    <Fragment>
      <StyledSearchBar onChange={handleSearch} />
      <ConsoleTable>
        {filteredBreadcrumbs.map((breadcrumb, i) => (
          <ConsoleMessage
            key={i}
            isLast={i === breadcrumbs.length - 1}
            breadcrumb={breadcrumb}
          />
        ))}
      </ConsoleTable>
    </Fragment>
  );
}

const ConsoleTable = styled(Panel)`
  display: grid;
  grid-template-columns: max-content auto;
  font-family: ${p => p.theme.text.familyMono};
  font-size: 0.8em;
`;

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(1)};
`;

export default Console;
