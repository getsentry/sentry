import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Button} from 'sentry/components/core/button';
import type {SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import DropdownButton from 'sentry/components/dropdownButton';
import {useInfiniteRepositoryBranches} from 'sentry/components/prevent/branchSelector/useInfiniteRepositoryBranches';
import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import {IconBranch} from 'sentry/icons/iconBranch';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

const ALL_BRANCHES = 'All Branches';

export function BranchSelector() {
  const {
    branch,
    integratedOrgId,
    integratedOrgName,
    repository,
    preventPeriod,
    changeContextValue,
  } = usePreventContext();
  const [searchValue, setSearchValue] = useState<string | undefined>();

  const {data, isFetching, isLoading} = useInfiniteRepositoryBranches({
    term: searchValue,
  });
  const branches = data.branches;

  const handleChange = useCallback(
    (selectedOption: SelectOption<string>) => {
      const newBranch =
        selectedOption.value === ALL_BRANCHES ? null : selectedOption.value;
      changeContextValue({
        integratedOrgName,
        integratedOrgId,
        repository,
        preventPeriod,
        branch: newBranch,
      });
    },
    [changeContextValue, integratedOrgName, integratedOrgId, repository, preventPeriod]
  );

  const handleOnSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchValue(value);
      }, 300),
    [setSearchValue]
  );

  const displayedBranches = useMemo(
    () => (isFetching ? [] : (branches?.map(item => item.name) ?? [])),
    [branches, isFetching]
  );

  const options = useMemo((): Array<SelectOption<string>> => {
    if (isFetching) {
      return [];
    }

    const optionSet = new Set<string>([
      ALL_BRANCHES,
      ...(branch ? [branch] : []),
      ...displayedBranches,
    ]);

    const makeOption = (value: string): SelectOption<string> => {
      return {
        value,
        label: <OptionLabel>{value}</OptionLabel>,
        textValue: value,
      };
    };

    return [...optionSet].map(makeOption);
  }, [branch, displayedBranches, isFetching]);

  useEffect(() => {
    // Create a use effect to cancel handleOnSearch fn on unmount to avoid memory leaks
    return () => {
      handleOnSearch.cancel();
    };
  }, [handleOnSearch]);

  const branchResetButton = useCallback(
    ({closeOverlay}: any) => {
      if (!branch || branch === ALL_BRANCHES) {
        return null;
      }

      return (
        <ResetButton
          onClick={() => {
            handleChange({value: ALL_BRANCHES});
            closeOverlay();
          }}
          size="zero"
          borderless
        >
          {t('Reset to all branches')}
        </ResetButton>
      );
    },
    [branch, handleChange]
  );

  function getEmptyMessage() {
    if (isFetching) {
      return t('Getting branches...');
    }

    if (searchValue && !displayedBranches.length) {
      return t('Sorry, no branches match your search query');
    }

    return t('No branches found');
  }

  const disabled = !repository;

  return (
    <CompactSelect
      loading={isLoading}
      searchable
      onSearch={handleOnSearch}
      disableSearchFilter
      searchPlaceholder={t('search by branch name')}
      menuTitle={t('Filter to branch')}
      options={options}
      value={branch ?? ALL_BRANCHES}
      onChange={handleChange}
      onOpenChange={_ => setSearchValue(undefined)}
      menuHeaderTrailingItems={branchResetButton}
      disabled={disabled}
      emptyMessage={getEmptyMessage()}
      closeOnSelect
      trigger={(triggerProps, isOpen) => {
        return (
          <DropdownButton
            isOpen={isOpen}
            data-test-id="page-filter-branch-selector"
            {...triggerProps}
          >
            <TriggerLabelWrap>
              <Flex align="center" gap="sm">
                <IconContainer>
                  <IconBranch />
                </IconContainer>
                <TriggerLabel>{branch || ALL_BRANCHES}</TriggerLabel>
              </Flex>
            </TriggerLabelWrap>
          </DropdownButton>
        );
      }}
      menuWidth="22em"
    />
  );
}

const TriggerLabelWrap = styled('span')`
  position: relative;
  min-width: 0;
  max-width: 200px;
`;

const TriggerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis}
  width: auto;
`;

const OptionLabel = styled('span')`
  white-space: normal;
  /* Remove custom margin added by SelectorItemLabel. Once we update custom hooks and
  remove SelectorItemLabel, we can delete this. */
  div {
    margin: 0;
  }
`;

const IconContainer = styled('div')`
  flex: 1 0 14px;
  height: 14px;
`;

const ResetButton = styled(Button)`
  font-size: inherit; /* Inherit font size from MenuHeader */
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.subText};
  padding: 0 ${space(0.5)};
  margin: ${p =>
    p.theme.isChonk
      ? `-${space(0.5)} -${space(0.5)}`
      : `-${space(0.25)} -${space(0.25)}`};
`;
