import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Hovercard} from 'sentry/components/hovercard';
import Link from 'sentry/components/links/link';
import {IconFilter} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';

// exporting for testing purposes
export function useCreateSummaryFilterLink(f_b_type: string) {
  const location = useLocation();
  const isFiltered = location.query.f_b_type === f_b_type;

  const filterLink = {
    ...location,
    query: {
      ...location.query,
      f_b_type,
    },
  };

  const revertFilterLink = {
    ...location,
    query: {
      ...location.query,
      f_b_type: undefined,
    },
  };

  return {
    isFiltered,
    filterLink: isFiltered ? revertFilterLink : filterLink,
  };
}

const StyledSummaryEntryLabel = styled('span')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: ${p => p.theme.fontWeightBold};
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
    font-weight: ${p => p.theme.fontWeightBold};
    display: block;
  }

  &[data-is-filtered='true'] {
    font-weight: ${p => p.theme.fontWeightBold};
  }

  &:hover {
    text-decoration: underline;
  }
`;

type SummaryEntryValueLinkProps = {
  children: React.ReactNode;
  filterBy: string;
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

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: repeat(${p => p.largeColumnSpan}, 1fr);
  }
`;

export const SummaryContainer = styled('div')<{columns: number}>`
  display: grid;
  grid-template-columns: repeat(${p => p.columns}, 1fr);
  gap: ${space(1)};
`;
