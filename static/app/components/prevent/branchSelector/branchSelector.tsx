import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Button} from '@sentry/scraps/button';
import type {SelectOption} from '@sentry/scraps/compactSelect';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

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

  const {data, isFetching} = useInfiniteRepositoryBranches({
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
      ...(searchValue ? [] : [ALL_BRANCHES]),
      ...(branch && !searchValue ? [branch] : []),
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
  }, [branch, displayedBranches, isFetching, searchValue]);

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
          priority="transparent"
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

    if (!displayedBranches.length) {
      if (searchValue?.length) {
        return t('No branches found. Please enter a different search term.');
      }
      return t('No branches found');
    }

    return undefined;
  }

  const disabled = !repository;

  return (
    <CompactSelect
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
      trigger={triggerProps => {
        return (
          <OverlayTrigger.Button
            data-test-id="page-filter-branch-selector"
            {...triggerProps}
          >
            <Container as="span" minWidth="0" maxWidth="200px" position="relative">
              <Flex align="center" gap="sm">
                <Container flex="1 0 14px" height="14px">
                  <IconBranch />
                </Container>
                <TriggerLabel>{branch || ALL_BRANCHES}</TriggerLabel>
              </Flex>
            </Container>
          </OverlayTrigger.Button>
        );
      }}
      menuWidth="22em"
    />
  );
}

const TriggerLabel = styled('span')`
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

const ResetButton = styled(Button)`
  font-size: inherit; /* Inherit font size from MenuHeader */
  font-weight: ${p => p.theme.font.weight.sans.regular};
  color: ${p => p.theme.tokens.content.secondary};
  padding: 0 ${space(0.5)};
  margin: -${space(0.5)} -${space(0.5)};
`;
