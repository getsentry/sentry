import {Children} from 'react';
import styled from '@emotion/styled';

import SearchBar from 'sentry/components/searchBar';
import space from 'sentry/styles/space';

type Props = {
  onChange: (value: string) => void;
  placeholder: string;
  query: string;
  className?: string;
  /**
   * The filter must be the SearchBarFilter component
   */
  filter?: React.ReactElement;
};

function SearchBarAction({onChange, query, placeholder, filter, className}: Props) {
  return (
    <Wrapper className={className}>
      {filter}
      <StyledSearchBar
        onChange={onChange}
        query={query}
        placeholder={placeholder}
        blendWithFilter={!!filter}
      />
    </Wrapper>
  );
}

export default SearchBarAction;

const Wrapper = styled('div')`
  display: grid;
  gap: ${space(2)};
  width: 100%;
  margin-top: ${space(1)};
  position: relative;

  @media (min-width: ${props => props.theme.breakpoints.small}) {
    margin-top: 0;
    gap: 0;
    grid-template-columns: ${p =>
      p.children && Children.toArray(p.children).length === 1
        ? '1fr'
        : 'max-content 1fr'};
    justify-content: flex-end;
  }

  @media (min-width: ${props => props.theme.breakpoints.medium}) {
    width: 400px;
  }

  @media (min-width: ${props => props.theme.breakpoints.xlarge}) {
    width: 600px;
  }
`;

// TODO(matej): remove this once we refactor SearchBar to not use css classes
// - it could accept size as a prop
const StyledSearchBar = styled(SearchBar)<{blendWithFilter?: boolean}>`
  width: 100%;
  position: relative;
  .search-input {
    height: 34px;
  }
  .search-clear-form,
  .search-input-icon {
    height: 32px;
    display: flex;
    align-items: center;
  }

  @media (min-width: ${props => props.theme.breakpoints.small}) {
    ${p =>
      p.blendWithFilter &&
      `
        .search-input,
        .search-input:focus {
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
        }
      `}
  }
`;
