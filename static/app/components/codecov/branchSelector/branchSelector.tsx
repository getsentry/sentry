import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {useInfiniteRepositoryBranches} from 'sentry/components/codecov/branchSelector/useInfiniteRepositoryBranches';
import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {Button} from 'sentry/components/core/button';
import type {SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import DropdownButton from 'sentry/components/dropdownButton';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {IconBranch} from './iconBranch';

export function BranchSelector() {
  const {branch, repository, changeContextValue} = useCodecovContext();
  const [searchValue, setSearchValue] = useState<string | undefined>();
  const {data} = useInfiniteRepositoryBranches({term: searchValue});
  const branches = data.branches;
  const defaultBranch = data.defaultBranch;

  const handleChange = useCallback(
    (selectedOption: SelectOption<string>) => {
      changeContextValue({branch: selectedOption.value});
    },
    [changeContextValue]
  );

  const handleOnSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchValue(value);
      }, 500),
    [setSearchValue]
  );

  const options = useMemo((): Array<SelectOption<string>> => {
    const optionSet = new Set<string>([
      ...(branch ? [branch] : []),
      ...(branches.length > 0 ? branches.map(item => item.name) : []),
    ]);

    const makeOption = (value: string): SelectOption<string> => {
      return {
        value,
        label: <OptionLabel>{value}</OptionLabel>,
        textValue: value,
      };
    };

    return [...optionSet].map(makeOption);
  }, [branch, branches]);

  useEffect(() => {
    // Create a use effect to cancel handleOnSearch fn on unmount to avoid memory leaks
    return () => {
      handleOnSearch.cancel();
    };
  }, [handleOnSearch]);

  const branchResetButton = useCallback(
    ({closeOverlay}: any) => {
      if (!defaultBranch || !branch || branch === defaultBranch) {
        return null;
      }

      return (
        <ResetButton
          onClick={() => {
            changeContextValue({branch: defaultBranch});
            closeOverlay();
          }}
          size="zero"
          borderless
        >
          {t('Reset to default')}
        </ResetButton>
      );
    },
    [branch, changeContextValue, defaultBranch]
  );

  const disabled = !repository;

  return (
    <CompactSelect
      searchable
      onSearch={handleOnSearch}
      searchPlaceholder={t('search by branch name')}
      options={options}
      value={branch ?? ''}
      onChange={handleChange}
      menuHeaderTrailingItems={branchResetButton}
      disabled={disabled}
      emptyMessage={'No branches found'}
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
                <TriggerLabel>{branch || t('Select branch')}</TriggerLabel>
              </Flex>
            </TriggerLabelWrap>
          </DropdownButton>
        );
      }}
      menuWidth={'22em'}
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
