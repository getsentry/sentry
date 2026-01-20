import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {CompositeSelect} from 'sentry/components/core/compactSelect/composite';
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
}

export default function FeatureFlagSort({
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
        <OverlayTrigger.IconButton
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
        }}
        options={sortByOptions}
        closeOnSelect={false}
      />
      <CompositeSelect.Region
        label={t('Order By')}
        value={orderBy}
        onChange={selection => {
          setOrderBy(selection.value);
        }}
        options={orderByOptions.filter(o => {
          const selectionType = getSelectionType(o.value);
          return selectionType === sortBy;
        })}
        closeOnSelect={false}
      />
    </CompositeSelect>
  );
}
