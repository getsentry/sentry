import type {Dispatch, SetStateAction} from 'react';

import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {SearchInput} from 'sentry/components/events/eventDrawer';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';

interface Props {
  includeFeatureFlagsTab: boolean;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  onChange?: () => void;
}

export default function DistributionSearchInput({
  includeFeatureFlagsTab,
  search,
  setSearch,
  onChange,
}: Props) {
  return (
    <InputGroup>
      <SearchInput
        size="xs"
        value={search}
        onChange={e => {
          setSearch(e.target.value);
          onChange?.();
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
