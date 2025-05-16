import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconArrow} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';

type HeaderParams = {
  alignment: string;
  fieldName: string;
  label: string;
  sort: undefined | Sort;
  tooltip?: string | ReactNode;
};

function SortableHeader({fieldName, label, sort, tooltip, alignment}: HeaderParams) {
  const location = useLocation();

  const arrowDirection = sort?.kind === 'asc' ? 'up' : 'down';
  const sortArrow = <IconArrow size="xs" direction={arrowDirection} />;

  return (
    <Header alignment={alignment}>
      <SortLink
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
      </SortLink>
      {tooltip ? (
        <StyledQuestionTooltip size="xs" position="top" title={tooltip} isHoverable />
      ) : null}
    </Header>
  );
}

const Header = styled('div')<{alignment: string}>`
  display: block;
  width: 100%;
  text-align: ${p => (p.alignment === 'left' ? 'left' : 'right')};
`;

const SortLink = styled(Link)`
  color: inherit;

  :hover {
    color: inherit;
  }

  svg {
    vertical-align: top;
  }
`;

const StyledQuestionTooltip = styled(QuestionTooltip)`
  margin-left: ${space(0.5)};
`;

export default SortableHeader;
