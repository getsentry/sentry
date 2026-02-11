import {Fragment, useCallback, type ReactNode} from 'react';
import {useSearchParams} from 'react-router-dom';
import styled from '@emotion/styled';

import {Link} from '@sentry/scraps/link';
import {Switch} from '@sentry/scraps/switch';

import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconArrow} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {SORTABLE_FIELDS} from 'sentry/views/prevent/tests/testAnalyticsTable/testAnalyticsTable';

type HeaderParams = {
  alignment: string;
  enableToggle: boolean;
  fieldName: string;
  label: string;
  sort?: Sort;
  tooltip?: string | ReactNode;
};

function WrapToggle() {
  const [searchParams, setSearchParams] = useSearchParams();
  const wrapValue = searchParams.get('wrap') === 'true';

  const toggle = useCallback(() => {
    const currentParams = Object.fromEntries(searchParams.entries());
    const updatedParams = {
      ...currentParams,
      wrap: (!wrapValue).toString(),
    };
    setSearchParams(updatedParams);
  }, [searchParams, setSearchParams, wrapValue]);

  return (
    <Fragment>
      | {wrapValue ? 'Wrap' : 'No Wrap'}
      <span>
        <Switch checked={wrapValue} size="sm" onChange={toggle} />{' '}
      </span>
    </Fragment>
  );
}

function SortableHeader({
  fieldName,
  label,
  sort,
  tooltip,
  alignment,
  enableToggle,
}: HeaderParams) {
  // TODO: refactor once API is done to use either or useLocation/useSearchParams
  const location = useLocation();

  const arrowDirection = sort?.kind === 'asc' ? 'up' : 'down';
  const sortArrow = <IconArrow size="xs" direction={arrowDirection} />;

  // Remove cursor and navigation params when sorting to start from first page
  const {
    cursor: _cursor,
    navigation: _navigation,
    ...queryWithoutPagination
  } = location.query;

  const isSortable = SORTABLE_FIELDS.includes(fieldName as any);

  return (
    <HeaderCell alignment={alignment}>
      {isSortable ? (
        <StyledLink
          role="columnheader"
          aria-sort={
            sort?.field.endsWith(fieldName)
              ? sort?.kind === 'asc'
                ? 'ascending'
                : 'descending'
              : 'none'
          }
          to={{
            pathname: location.pathname,
            query: {
              ...queryWithoutPagination,
              sort: sort?.field.endsWith(fieldName)
                ? sort?.kind === 'desc'
                  ? fieldName
                  : '-' + fieldName
                : '-' + fieldName,
            },
          }}
        >
          {label} {sort?.field === fieldName && sortArrow}
        </StyledLink>
      ) : (
        <NonSortableHeader role="columnheader">{label}</NonSortableHeader>
      )}
      {enableToggle ? <WrapToggle /> : null}
      {tooltip ? <QuestionTooltip size="xs" title={tooltip} isHoverable /> : null}
    </HeaderCell>
  );
}

const HeaderCell = styled('div')<{alignment: string}>`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  width: 100%;
  justify-content: ${p => (p.alignment === 'left' ? 'flex-start' : 'flex-end')};
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;

const StyledLink = styled(Link)`
  color: inherit;

  :hover {
    color: inherit;
  }

  svg {
    vertical-align: top;
  }
`;

const NonSortableHeader = styled('span')`
  color: inherit;
`;

export default SortableHeader;
