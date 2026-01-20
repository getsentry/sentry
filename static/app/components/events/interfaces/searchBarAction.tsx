import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import type {
  SelectOption,
  SelectOptionOrSection,
} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import SearchBar from 'sentry/components/searchBar';
import {t, tn} from 'sentry/locale';

type Props = {
  onChange: (value: string) => void;
  onFilterChange: (options: Array<SelectOption<string>>) => void;
  placeholder: string;
  query: string;
  className?: string;
  filterOptions?: Array<SelectOptionOrSection<string>>;
  filterSelections?: Array<SelectOption<string>>;
};

function SearchBarAction({
  onChange,
  query,
  placeholder,
  filterOptions,
  filterSelections,
  onFilterChange,
  className,
}: Props) {
  return (
    <Wrapper className={className}>
      {filterOptions && (
        <CompactSelect
          size="sm"
          multiple
          maxMenuHeight={400}
          options={filterOptions}
          value={filterSelections?.map(f => f.value)}
          onChange={onFilterChange}
          trigger={props => (
            <StyledTrigger
              priority={
                filterSelections && filterSelections.length > 0 ? 'primary' : 'default'
              }
              {...props}
            >
              {filterSelections?.length
                ? tn('%s Active Filter', '%s Active Filters', filterSelections.length)
                : t('Filter By')}
            </StyledTrigger>
          )}
        />
      )}
      <StyledSearchBar
        size="sm"
        onChange={onChange}
        query={query}
        placeholder={placeholder}
        blendWithFilter={!!filterOptions}
      />
    </Wrapper>
  );
}

export default SearchBarAction;

const Wrapper = styled('div')`
  display: flex;
  width: 100%;
  justify-content: flex-end;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    width: 350px;
  }

  @media (min-width: ${p => p.theme.breakpoints.xl}) {
    width: 500px;
  }
`;

const StyledSearchBar = styled(SearchBar)<{blendWithFilter?: boolean}>`
  width: 100%;

  ${p =>
    p.blendWithFilter &&
    css`
      input {
        border-radius: 0 ${p.theme.radius.md} ${p.theme.radius.md} 0;
        border-left-width: 0;
      }
    `}
`;

const StyledTrigger = styled(OverlayTrigger.Button)`
  border-radius: ${p => p.theme.radius.md} 0 0 ${p => p.theme.radius.md};
`;
