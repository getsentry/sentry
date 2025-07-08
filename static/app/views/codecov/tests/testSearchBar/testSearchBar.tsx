import {useCallback} from 'react';
import {useSearchParams} from 'react-router-dom';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import BaseSearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

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

  const handleSearchChange = useCallback(
    () =>
      debounce((newValue: string) => {
        setSearchParams(prev => {
          const currentParams = Object.fromEntries(prev.entries());

          if (newValue) {
            currentParams.term = newValue;
          } else {
            delete currentParams.term;
          }

          return currentParams;
        });
      }, 500),
    [setSearchParams]
  );

  return (
    <Container>
      <Title>{searchTitle}</Title>
      <StyledSearchBar
        placeholder={t('Search by test name')}
        onChange={handleSearchChange}
        query={term}
      />
    </Container>
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

const Container = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1.5)};
  width: 100%;
`;
