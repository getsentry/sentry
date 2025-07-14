import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {Button} from 'sentry/components/core/button';
import type {SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import DropdownButton from 'sentry/components/dropdownButton';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {IconBranch} from './iconBranch';

const SAMPLE_BRANCH_ITEMS = ['main', 'master'];

export function BranchSelector() {
  const {branch, repository, changeContextValue} = useCodecovContext();

  // TODO: create endpoint that exposes repository's default branch
  const defaultBranch = 'main';

  const handleChange = useCallback(
    (selectedOption: SelectOption<string>) => {
      changeContextValue({branch: selectedOption.value});
    },
    [changeContextValue]
  );

  const options = useMemo((): Array<SelectOption<string>> => {
    const optionSet = new Set<string>([
      ...(branch ? [branch] : []),
      ...(SAMPLE_BRANCH_ITEMS.length ? SAMPLE_BRANCH_ITEMS : []),
    ]);

    const makeOption = (value: string): SelectOption<string> => {
      return {
        value,
        label: <OptionLabel>{value}</OptionLabel>,
        textValue: value,
      };
    };

    return [...optionSet].map(makeOption);
  }, [branch]);

  const branchResetButton = useCallback(
    ({closeOverlay}: any) => {
      if (!branch || branch === defaultBranch) {
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
    [branch, changeContextValue]
  );

  const disabled = !repository;

  return (
    <CompactSelect
      searchable
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
              <Flex align="center" gap={space(0.75)}>
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
