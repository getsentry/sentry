import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Panel} from 'sentry/components/panels';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {BreadcrumbTypeDefault} from 'sentry/types/breadcrumbs';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

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
