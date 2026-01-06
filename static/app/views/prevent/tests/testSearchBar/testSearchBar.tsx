import {useEffect, useMemo} from 'react';
import {useSearchParams} from 'react-router-dom';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Flex} from '@sentry/scraps/layout';

import BaseSearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';

const FILTER_TO_NAME = {
  slowestTests: 'Slowest Tests',
  flakyTests: 'Flaky Tests',
  failedTests: 'Failed Tests',
  skippedTests: 'Skipped Tests',
};

type TestSearchBarProps = {
  testCount: number;
};

export function TestSearchBar({testCount}: TestSearchBarProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const term = searchParams.get('term') || '';

  const filterBy = searchParams.get('filterBy') || '';
  const testTitle =
    filterBy in FILTER_TO_NAME
      ? FILTER_TO_NAME[filterBy as keyof typeof FILTER_TO_NAME]
      : 'Tests';
  const count = testCount > 999 ? `${(testCount / 1000).toFixed(1)}K` : testCount;
  const searchTitle = `${testTitle} (${count})`;

  const handleSearchChange = useMemo(
    () =>
      debounce((newValue: string) => {
        setSearchParams(prev => {
          const currentParams = Object.fromEntries(prev.entries());

          // Remove cursor and navigation params when searching to start from first page
          const {
            cursor: _cursor,
            navigation: _navigation,
            ...paramsWithoutPagination
          } = currentParams;

          if (newValue) {
            paramsWithoutPagination.term = newValue;
          } else {
            delete paramsWithoutPagination.term;
          }

          return paramsWithoutPagination;
        });
      }, 500),
    [setSearchParams]
  );

  useEffect(() => {
    // Create a use effect to cancel handleSearchChange fn on unmount to avoid memory leaks
    return () => {
      handleSearchChange.cancel();
    };
  }, [handleSearchChange]);

  return (
    <Flex align="center" gap="lg" width="100%">
      <Title>{searchTitle}</Title>
      <StyledSearchBar
        placeholder={t('Search by test name')}
        onChange={handleSearchChange}
        query={term}
      />
    </Flex>
  );
}

const StyledSearchBar = styled(BaseSearchBar)`
  flex: 1 1 auto;
  min-width: 0;
`;

const Title = styled('h2')`
  white-space: nowrap;
  flex-shrink: 0;
  margin: 0;
  font-size: ${p => p.theme.fontSize.xl};
`;
