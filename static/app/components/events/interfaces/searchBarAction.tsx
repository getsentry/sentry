import styled from '@emotion/styled';

import type {SelectOption, SelectOptionOrSection} from '@sentry/scraps/compactSelect';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {SearchBar} from 'sentry/components/searchBar';
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

export function SearchBarAction({
  onChange,
  query,
  placeholder,
  filterOptions,
  filterSelections,
  onFilterChange,
  className,
}: Props) {
  return (
    <Flex
      className={className}
      width={{zero: '100%', xl: '500px'}}
      maxWidth="500px"
      gap="sm"
    >
      {filterOptions && (
        <CompactSelect
          size="sm"
          multiple
          maxMenuHeight={400}
          options={filterOptions}
          value={filterSelections?.map(f => f.value)}
          onChange={onFilterChange}
          trigger={props => (
            <OverlayTrigger.Button
              variant={
                filterSelections && filterSelections.length > 0 ? 'primary' : 'secondary'
              }
              {...props}
            >
              {filterSelections?.length
                ? tn('%s Active Filter', '%s Active Filters', filterSelections.length)
                : t('Filter By')}
            </OverlayTrigger.Button>
          )}
        />
      )}
      <StyledSearchBar
        size="sm"
        onChange={onChange}
        query={query}
        placeholder={placeholder}
      />
    </Flex>
  );
}

const StyledSearchBar = styled(SearchBar)`
  width: 100%;
`;
