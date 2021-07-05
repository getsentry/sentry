import {Children} from 'react';
import styled from '@emotion/styled';

import SearchBar from 'app/components/searchBar';
import space from 'app/styles/space';

type Props = {
  onChange: (value: string) => void;
  query: string;
  placeholder: string;
  /**
   * The filter must be the SearchBarFilter component
   */
  filter?: React.ReactElement;
  className?: string;
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
  grid-gap: ${space(2)};
  width: 100%;
  margin-top: ${space(1)};
  position: relative;

  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    margin-top: 0;
    grid-gap: 0;
    grid-template-columns: ${p =>
      p.children && Children.toArray(p.children).length === 1
        ? '1fr'
        : 'max-content 1fr'};
    justify-content: flex-end;
  }

  @media (min-width: ${props => props.theme.breakpoints[1]}) {
    width: 400px;
  }

  @media (min-width: ${props => props.theme.breakpoints[3]}) {
    width: 600px;
  }
`;

// TODO(matej): remove this once we refactor SearchBar to not use css classes
// - it could accept size as a prop
const StyledSearchBar = styled(SearchBar)<{blendWithFilter?: boolean}>`
  width: 100%;
  position: relative;
  .search-input {
    height: 32px;
  }
  .search-clear-form,
  .search-input-icon {
    height: 32px;
    display: flex;
    align-items: center;
  }

  @media (min-width: ${props => props.theme.breakpoints[0]}) {
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
