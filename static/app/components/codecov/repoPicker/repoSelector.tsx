import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import type {SelectOption, SingleSelectProps} from 'sentry/components/core/compactSelect';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import DropdownButton from 'sentry/components/dropdownButton';
import {t} from 'sentry/locale';

const CODECOV_PLACEHOLDER_REPOS = ['test repo 1', 'test-repo-2', 'Test Repo 3'];

export interface RepoSelectorProps {
  onChange: (data: string) => void;
  /**
   * Repository value
   */
  repository: string | null;
  /**
   * Optional trigger for the assignee selector. If nothing passed in,
   * the default trigger will be used
   */
  trigger?: (
    props: Omit<React.HTMLAttributes<HTMLElement>, 'children'>,
    isOpen: boolean
  ) => React.ReactNode;
}

export function RepoSelector({onChange, trigger, repository}: RepoSelectorProps) {
  const options = useMemo((): Array<SelectOption<string>> => {
    // TODO: When API is ready, replace placeholder w/ api response
    const repoSet = new Set([
      ...(repository ? [repository] : []),
      ...(CODECOV_PLACEHOLDER_REPOS.length ? CODECOV_PLACEHOLDER_REPOS : []),
    ]);

    return [...repoSet].map((value): SelectOption<string> => {
      return {
        // TODO: ideally this has a unique id, possibly adjust set to an
        // object when you have backend response
        value,
        label: <OptionLabel>{value}</OptionLabel>,
        textValue: value,
      };
    });
  }, [repository]);

  const handleChange = useCallback<NonNullable<SingleSelectProps<string>['onChange']>>(
    newSelected => {
      onChange(newSelected.value);
    },
    [onChange]
  );

  return (
    <CompactSelect
      options={options}
      value={repository ?? ''}
      onChange={handleChange}
      menuWidth={'16rem'}
      trigger={
        trigger ??
        ((triggerProps, isOpen) => {
          const defaultLabel = options.some(item => item.value === repository)
            ? repository?.toUpperCase()
            : t('Select Repo');

          return (
            <DropdownButton
              isOpen={isOpen}
              data-test-id="page-filter-codecov-repository-selector"
              {...triggerProps}
            >
              <TriggerLabelWrap>
                <TriggerLabel>{defaultLabel}</TriggerLabel>
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
