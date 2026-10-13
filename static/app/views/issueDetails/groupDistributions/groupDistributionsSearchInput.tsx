import type {Dispatch, SetStateAction} from 'react';
import {IconSearch} from '@sentry/icons/search';

import {InputGroup} from '@sentry/scraps/input';

import {t} from 'sentry/locale';

interface Props {
  includeFeatureFlagsTab: boolean;
  onChange: Dispatch<SetStateAction<string>>;
  search: string;
}

export function GroupDistributionsSearchInput({
  includeFeatureFlagsTab,
  search,
  onChange,
}: Props) {
  return (
    <InputGroup>
      <InputGroup.Input
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
