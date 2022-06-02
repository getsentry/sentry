import styled from '@emotion/styled';

import DropdownButtonV2 from 'sentry/components/dropdownButtonV2';
import CompactSelect from 'sentry/components/forms/compactSelect';
import SearchBar from 'sentry/components/searchBar';
import {t, tn} from 'sentry/locale';
import space from 'sentry/styles/space';

type FilterOption = React.ComponentProps<typeof CompactSelect>['options'][0];

type Props = {
  onChange: (value: string) => void;
  placeholder: string;
  query: string;
  className?: string;
  filterOptions?: FilterOption[];
  filterSelections?: FilterOption[];
  onFilterChange?: (options: FilterOption[]) => void;
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
  const trigger: React.ComponentProps<typeof CompactSelect>['trigger'] = ({
    props,
    ref,
  }) => (
    <StyledTrigger
      size="small"
      priority={filterSelections && filterSelections.length > 0 ? 'primary' : 'default'}
      ref={ref}
      {...props}
    >
      {filterSelections?.length
        ? tn('%s Active Filter', '%s Active Filters', filterSelections.length)
        : t('Filter By')}
    </StyledTrigger>
  );

  return (
    <Wrapper className={className}>
      {filterOptions && (
        <CompactSelect
          multiple
          maxMenuHeight={400}
          options={filterOptions}
          value={filterSelections?.map(f => f.value)}
          onChange={onFilterChange}
          trigger={trigger}
        />
      )}
      <StyledSearchBar
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

  @media (max-width: ${props => props.theme.breakpoints[0]}) {
    margin-top: ${space(1)};
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
    height: 34px;
  }
  .search-clear-form,
  .search-input-icon {
    height: 32px;
    display: flex;
    align-items: center;
  }

  ${p =>
    p.blendWithFilter &&
    `
      .search-input,
      .search-input:focus {
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
        border-left: 0;
      }
    `}
`;

const StyledTrigger = styled(DropdownButtonV2)`
  border-radius: ${p => p.theme.borderRadiusLeft};
`;
