import styled from '@emotion/styled';

import {
  CompactSelect,
  SelectOption,
  SelectOptionOrSection,
} from 'sentry/components/compactSelect';
import DropdownButton from 'sentry/components/dropdownButton';
import SearchBar from 'sentry/components/searchBar';
import {t, tn} from 'sentry/locale';

type Props = {
  onChange: (value: string) => void;
  placeholder: string;
  query: string;
  className?: string;
  filterOptions?: SelectOptionOrSection<string>[];
  filterSelections?: SelectOption<string>[];
  onFilterChange?: (options: SelectOption<string>[]) => void;
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
  const trigger: React.ComponentProps<typeof CompactSelect>['trigger'] = (
    props,
    isOpen
  ) => (
    <StyledTrigger
      isOpen={isOpen}
      size="sm"
      priority={filterSelections && filterSelections.length > 0 ? 'primary' : 'default'}
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
          size="sm"
          multiple
          maxMenuHeight={400}
          options={filterOptions}
          value={filterSelections?.map(f => f.value)}
          onChange={onFilterChange}
          trigger={trigger}
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

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    width: 350px;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    width: 500px;
  }
`;

const StyledSearchBar = styled(SearchBar)<{blendWithFilter?: boolean}>`
  width: 100%;

  ${p =>
    p.blendWithFilter &&
    `
      input {
        border-radius: ${p.theme.borderRadiusRight};
        border-left-width: 0;
      }
    `}
`;

const StyledTrigger = styled(DropdownButton)`
  border-radius: ${p => p.theme.borderRadiusLeft};
`;
