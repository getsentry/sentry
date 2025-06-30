import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import type {SelectOption} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import DropdownButton from 'sentry/components/dropdownButton';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {IconBranch} from './iconBranch';

const SAMPLE_BRANCH_ITEMS = ['main', 'master'];

export function BranchSelector() {
  const {branch, changeContextValue} = useCodecovContext();

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

  return (
    <CompactSelect
      options={options}
      value={branch ?? ''}
      onChange={handleChange}
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
