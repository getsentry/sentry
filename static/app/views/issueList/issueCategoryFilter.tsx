import React, {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import FeatureBadge from 'sentry/components/featureBadge';
import {IconStack} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {IssueCategory} from 'sentry/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

const ISSUE_CATEGORY_FILTER = 'issue.category';

function IssueCategoryFilter({
  query,
  onSearch,
}: {
  onSearch: (query: string) => void;
  query: string;
}) {
  const [isPerformanceSeen, setIsPerformanceSeen] = useLocalStorageState(
    'issue-category-dropdown-seen:performance',
    false
  );

  const renderLabel = useCallback(
    (issueCategory?: IssueCategory, isTriggerLabel?: boolean) => {
      switch (issueCategory) {
        case IssueCategory.ERROR:
          return t('Errors');
        case IssueCategory.PERFORMANCE:
          return (
            <React.Fragment>
              {t('Performance')}
              {!isTriggerLabel && !isPerformanceSeen && <FeatureBadge type="new" />}
            </React.Fragment>
          );
        default:
          return t('All Categories');
      }
    },
    [isPerformanceSeen]
  );

  const options = useMemo(
    () => [
      {label: renderLabel(), value: 'all_categories'},
      {label: renderLabel(IssueCategory.ERROR), value: IssueCategory.ERROR},
      {label: renderLabel(IssueCategory.PERFORMANCE), value: IssueCategory.PERFORMANCE},
    ],
    [renderLabel]
  );

  const [selectedOption, setSelectedOption] = useState<SelectOption<string>>(options[0]);

  // Effect that handles setting the current option if the query is changed manually
  useEffect(() => {
    setSelectedOption(prevOption => {
      const queryOption = options.find(({value}) =>
        query.includes(`${ISSUE_CATEGORY_FILTER}:${value}`)
      );

      if (!queryOption) {
        return options[0];
      }

      if (queryOption.value !== prevOption.value) {
        return queryOption;
      }

      return prevOption;
    });
  }, [query, options]);

  const handleChange = (option: SelectOption<string>) => {
    const search = new MutableSearch(query);

    if (option.value === 'all_categories') {
      search.removeFilter(ISSUE_CATEGORY_FILTER);
    } else {
      search.setFilterValues(ISSUE_CATEGORY_FILTER, [option.value]);
    }

    if (option.value === 'performance') {
      setIsPerformanceSeen(true);
    }

    setSelectedOption(option);
    onSearch(search.formatString());
  };

  return (
    <React.Fragment>
      <CompactSelect
        options={options}
        value={selectedOption.value}
        triggerLabel={
          <React.Fragment>
            <Icon /> {renderLabel(selectedOption.value as IssueCategory, true)}
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
