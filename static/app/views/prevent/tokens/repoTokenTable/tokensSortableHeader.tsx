import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {IconArrow} from 'sentry/icons';
import type {Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';

type HeaderParams = {
  fieldName: string;
  label: string;
  sort?: Sort;
};

function TokensSortableHeader({fieldName, label, sort}: HeaderParams) {
  const location = useLocation();

  const arrowDirection = sort?.kind === 'asc' ? 'up' : 'down';
  const sortArrow = <IconArrow size="xs" direction={arrowDirection} />;

  const {
    cursor: _cursor,
    navigation: _navigation,
    ...queryWithoutPagination
  } = location.query;

  const getNextSortState = () => {
    const currentSort = sort?.field === fieldName ? sort : undefined;

    if (!currentSort) {
      return fieldName;
    }

    if (currentSort.kind === 'asc') {
      return '-' + fieldName;
    }

    return undefined;
  };

  const nextSort = getNextSortState();

  const nextQuery = {...queryWithoutPagination};
  if (nextSort) {
    nextQuery.sort = nextSort;
  } else {
    delete nextQuery.sort;
  }

  return (
    <Flex align="center" gap="sm" justify="start" width="100%">
      <StyledLink
        role="columnheader"
        aria-sort={
          sort?.field === fieldName
            ? sort?.kind === 'asc'
              ? 'ascending'
              : 'descending'
            : 'none'
        }
        to={{
          pathname: location.pathname,
          query: nextQuery,
        }}
      >
        {label} {sort?.field === fieldName && sortArrow}
      </StyledLink>
    </Flex>
  );
}

const StyledLink = styled(Link)`
  color: inherit;

  :hover {
    color: inherit;
  }

  svg {
    vertical-align: top;
  }
`;

export default TokensSortableHeader;
