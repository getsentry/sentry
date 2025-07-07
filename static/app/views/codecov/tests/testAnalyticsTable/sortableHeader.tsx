import {Fragment, type ReactNode, useCallback} from 'react';
import {useSearchParams} from 'react-router-dom';
import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import {Switch} from 'sentry/components/core/switch';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconArrow} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';

type HeaderParams = {
  alignment: string;
  enableToggle: boolean;
  fieldName: string;
  label: string;
  sort: undefined | Sort;
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
      | <WrapText>{wrapValue ? 'Wrap' : 'No Wrap'}</WrapText>
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

  return (
    <HeaderCell alignment={alignment}>
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
            ...location.query,
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
      {enableToggle ? <WrapToggle /> : null}
      {tooltip ? (
        <span>
          <QuestionTooltip size="xs" title={tooltip} isHoverable />
        </span>
      ) : null}
    </HeaderCell>
  );
}

const HeaderCell = styled('div')<{alignment: string}>`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  width: 100%;
  justify-content: ${p => (p.alignment === 'left' ? 'flex-start' : 'flex-end')};
  font-weight: ${p => p.theme.fontWeight.bold};
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

const WrapText = styled('span')`
  margin-left: ${space(0.5)};
`;

export default SortableHeader;
