import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {
  mapIndividualRepository,
  mapRepositoryList,
} from 'sentry/components/codecov/utils';
import type {SelectOption, SingleSelectProps} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import DropdownButton from 'sentry/components/dropdownButton';
import {t} from 'sentry/locale';

const CODECOV_PLACEHOLDER_REPOS = ['test repo 1', 'test-repo-2', 'Test Repo 3'];

export interface RepoSelectorProps
  extends Omit<
    SingleSelectProps<string>,
    'multiple' | 'hideOptions' | 'onChange' | 'onClose' | 'options' | 'value'
  > {
  /**
   * Relative date value
   */
  repository: string | null;
  /**
   * Custom width value for compact select
   */
  menuWidth?: string;
  onChange?: (data: string) => void;
}

export function RepoSelector({
  menuWidth,
  onChange,
  trigger,
  repository,
  ...selectProps
}: RepoSelectorProps) {
  const options = useMemo((): Array<SelectOption<string>> => {
    const selectedRepository = mapIndividualRepository(repository);
    // TODO: When API is ready, fetch the options from API
    const repositoryList = mapRepositoryList(CODECOV_PLACEHOLDER_REPOS);

    const repositoriesMap = {
      ...selectedRepository,
      ...repositoryList,
    };

    // TODO: ensure list is sorted when API is implemented
    const repositoriesList = Object.entries(repositoriesMap);

    return repositoriesList.map(([value, label]): SelectOption<string> => {
      return {
        value,
        label: <OptionLabel>{label}</OptionLabel>,
        textValue: typeof label === 'string' ? label : value,
      };
    });
  }, [repository]);

  const handleChange = useCallback<NonNullable<SingleSelectProps<string>['onChange']>>(
    newSelected => {
      onChange?.(newSelected.value);
    },
    [onChange]
  );

  return (
    <CompactSelect
      {...selectProps}
      options={options}
      value={repository ?? ''}
      onChange={handleChange}
      menuWidth={menuWidth ?? '16rem'}
      trigger={
        trigger ??
        ((triggerProps, isOpen) => {
          const defaultLabel = options.some(item => item.value === repository)
            ? repository?.toUpperCase()
            : t('Select Repo');

          return (
            <DropdownButton
              isOpen={isOpen}
              size={selectProps.size}
              data-test-id="page-filter-codecov-repository-selector"
              {...triggerProps}
              {...selectProps.triggerProps}
            >
              <TriggerLabelWrap>
                <TriggerLabel>{selectProps.triggerLabel ?? defaultLabel}</TriggerLabel>
              </TriggerLabelWrap>
            </DropdownButton>
          );
        })
      }
    />
  );
}

const TriggerLabelWrap = styled('span')`
  position: relative;
  min-width: 0;
`;

const TriggerLabel = styled('span')`
  ${p => p.theme.overflowEllipsis}
  width: auto;
`;

const OptionLabel = styled('span')`
  div {
    margin: 0;
  }
`;
