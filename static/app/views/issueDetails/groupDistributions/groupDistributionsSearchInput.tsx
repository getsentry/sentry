import type {Dispatch, SetStateAction} from 'react';
import styled from '@emotion/styled';

import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';

interface Props {
  includeFeatureFlagsTab: boolean;
  onChange: Dispatch<SetStateAction<string>>;
  search: string;
}

export default function GroupDistributionsSearchInput({
  includeFeatureFlagsTab,
  search,
  onChange,
}: Props) {
  return (
    <InputGroup>
      <SearchInput
        size="xs"
        value={search}
        onChange={e => {
          onChange?.(e.target.value);
        }}
        aria-label={
          includeFeatureFlagsTab
            ? t('Search All Tags & Feature Flags')
            : t('Search All Tags')
        }
      />
      <InputGroup.TrailingItems disablePointerEvents>
        <IconSearch size="xs" />
      </InputGroup.TrailingItems>
    </InputGroup>
  );
}

const SearchInput = styled(InputGroup.Input)`
  border: 0;
  box-shadow: unset;
  color: inherit;
`;
