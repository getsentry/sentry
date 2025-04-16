import {Button} from 'sentry/components/core/button';
import {CompositeSelect} from 'sentry/components/core/compactSelect/composite';
import type {SelectOption} from 'sentry/components/core/compactSelect/types';
import {
  getDefaultOrderBy,
  getSelectionType,
  type OrderBy,
  type SortBy,
} from 'sentry/components/events/featureFlags/utils';
import {IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';

interface Props {
  orderBy: OrderBy;
  orderByOptions: Array<{
    label: string;
    value: OrderBy;
  }>;
  setOrderBy: (value: React.SetStateAction<OrderBy>) => void;
  setSortBy: (value: React.SetStateAction<SortBy>) => void;
  sortBy: SortBy;
  sortByOptions: Array<{
    label: string;
    value: SortBy;
  }>;
  onChange?: (selection: SelectOption<SortBy | OrderBy>) => void;
}

export default function FeatureFlagSort({
  onChange,
  sortBy,
  orderBy,
  setOrderBy,
  setSortBy,
  orderByOptions,
  sortByOptions,
}: Props) {
  return (
    <CompositeSelect
      trigger={triggerProps => (
        <Button
          {...triggerProps}
          aria-label={t('Sort Flags')}
          size="xs"
          icon={<IconSort />}
          title={t('Sort Flags')}
        />
      )}
    >
      <CompositeSelect.Region
        label={t('Sort By')}
        value={sortBy}
        onChange={selection => {
          if (selection.value !== sortBy) {
            setOrderBy(getDefaultOrderBy(selection.value));
          }
          setSortBy(selection.value);
          onChange?.(selection);
        }}
        options={sortByOptions}
      />
      <CompositeSelect.Region
        label={t('Order By')}
        value={orderBy}
        onChange={selection => {
          setOrderBy(selection.value);
          onChange?.(selection);
        }}
        options={orderByOptions.map(o => {
          const selectionType = getSelectionType(o.value);
          return selectionType === sortBy ? o : {...o, disabled: true};
        })}
      />
    </CompositeSelect>
  );
}
