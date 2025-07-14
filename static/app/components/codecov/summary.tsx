import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import {Hovercard} from 'sentry/components/hovercard';
import {IconFilter} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import type {SummaryFilterKey} from 'sentry/views/codecov/tests/config';

// exporting for testing purposes
export function useCreateSummaryFilterLink(filterBy: SummaryFilterKey) {
  const location = useLocation();
  const isFiltered = location.query.filterBy === filterBy;

  const filterLink = {
    ...location,
    query: {
      ...location.query,
      filterBy,
    },
  };

  const revertFilterLink = {
    ...location,
    query: {
      ...location.query,
      filterBy: undefined,
    },
  };

  return {
    isFiltered,
    filterLink: isFiltered ? revertFilterLink : filterLink,
  };
}

const StyledSummaryEntryLabel = styled('span')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.gray300};
`;

interface SummaryEntryLabelProps extends React.ComponentProps<typeof Hovercard> {
  children: React.ReactNode;
}

export function SummaryEntryLabel({children, ...props}: SummaryEntryLabelProps) {
  return (
    <Hovercard {...props}>
      <StyledSummaryEntryLabel>{children}</StyledSummaryEntryLabel>
    </Hovercard>
  );
}

const SummaryEntryBase = css`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  font-size: 2.25rem;
`;

export const SummaryEntryValue = styled('span')`
  ${SummaryEntryBase}
  color: ${p => p.theme.textColor};
`;

const StyledSummaryEntryValueLink = styled('span')`
  font-variant-numeric: tabular-nums;
  color: ${p => p.theme.blue300};
  font-size: 2.25rem;

  /* This stops the text from jumping when becoming bold */
  &::after {
    content: attr(data-text);
    height: 0;
    visibility: hidden;
    overflow: hidden;
    pointer-events: none;
    font-weight: ${p => p.theme.fontWeight.bold};
    display: block;
  }

  &[data-is-filtered='true'] {
    font-weight: ${p => p.theme.fontWeight.bold};
  }

  &:hover {
    text-decoration: underline;
  }
`;

type SummaryEntryValueLinkProps = {
  children: React.ReactNode;
  filterBy: SummaryFilterKey;
};

export function SummaryEntryValueLink({children, filterBy}: SummaryEntryValueLinkProps) {
  const {filterLink, isFiltered} = useCreateSummaryFilterLink(filterBy);

  return (
    <div style={{display: 'flex', alignItems: 'center', gap: space(0.5)}}>
      <IconFilter />
      <Link to={filterLink}>
        <StyledSummaryEntryValueLink data-is-filtered={isFiltered}>
          {children}
        </StyledSummaryEntryValueLink>
      </Link>
    </div>
  );
}

export const SummaryEntry = styled('div')<{columns?: number}>`
  display: flex;
  flex-direction: column;
  align-items: start;
  justify-content: space-between;
  grid-column: span ${p => p.columns ?? 1};
`;

export const SummaryEntries = styled('div')<{
  largeColumnSpan: number;
  smallColumnSpan: number;
}>`
  display: grid;
  align-items: start;
  justify-content: space-between;
  gap: ${space(1)};
  padding-left: ${space(2)};
  padding-right: ${space(2)};
  padding-top: ${space(3)};
  padding-bottom: ${space(1)};
  grid-template-columns: repeat(${p => p.smallColumnSpan}, 1fr);

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    grid-template-columns: repeat(${p => p.largeColumnSpan}, 1fr);
  }
`;

export const SummaryContainer = styled('div')<{columns: number}>`
  display: grid;
  grid-template-columns: repeat(${p => p.columns}, 1fr);
  gap: ${space(1)};
`;
