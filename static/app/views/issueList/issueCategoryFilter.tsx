import React, {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import {IconStack} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

const ISSUE_CATEGORY_FILTER = 'issue.category';

function IssueCategoryFilter({
  query,
  onSearch,
}: {
  onSearch: (query: string) => void;
  query: string;
}) {
  const items: SelectOption<string>[] = [
    {label: t('All Categories'), value: 'all_categories'},
    {label: t('Errors'), value: 'error'},
    {label: t('Performance'), value: 'performance'},
  ];
  const [selectedOption, setSelectedOption] = useState<SelectOption<string>>(items[0]);

  useEffect(() => {
    const queryOption = items.find(({value}) =>
      query.includes(`${ISSUE_CATEGORY_FILTER}:${value}`)
    );

    if (!queryOption) {
      setSelectedOption(items[0]);
    }

    if (queryOption && queryOption.value !== selectedOption.value) {
      setSelectedOption(queryOption);
    }
  }, [query]);

  const handleChange = (option: SelectOption<string>) => {
    const search = new MutableSearch(query);

    if (option.value === 'all_categories') {
      search.removeFilter(ISSUE_CATEGORY_FILTER);
    } else {
      search.setFilterValues(ISSUE_CATEGORY_FILTER, [option.value]);
    }

    setSelectedOption(option);
    onSearch(search.formatString());
  };

  return (
    <React.Fragment>
      <CompactSelect
        options={items}
        value={selectedOption.value}
        triggerLabel={
          <React.Fragment>
            <Icon /> {selectedOption.label}
          </React.Fragment>
        }
        onChange={handleChange}
        menuWidth={250}
        size="md"
      />
    </React.Fragment>
  );
}

const Icon = styled(IconStack)`
  margin-right: ${space(1)};
`;

export default IssueCategoryFilter;
