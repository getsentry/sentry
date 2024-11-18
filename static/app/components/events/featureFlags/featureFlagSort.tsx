import {Button} from 'sentry/components/button';
import {CompositeSelect} from 'sentry/components/compactSelect/composite';
import {
  getDefaultOrderBy,
  getSelectionType,
  ORDER_BY_OPTIONS,
  type OrderBy,
  SORT_BY_OPTIONS,
  type SortBy,
} from 'sentry/components/events/featureFlags/utils';
import {IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  orderBy: OrderBy;
  setOrderBy: (value: React.SetStateAction<OrderBy>) => void;
  setSortBy: (value: React.SetStateAction<SortBy>) => void;
  sortBy: SortBy;
}

export default function FeatureFlagSort({sortBy, orderBy, setOrderBy, setSortBy}: Props) {
  const organization = useOrganization();

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
          trackAnalytics('flags.sort_flags', {
            organization,
            sortMethod: selection.value,
          });
        }}
        options={SORT_BY_OPTIONS}
      />
      <CompositeSelect.Region
        label={t('Order By')}
        value={orderBy}
        onChange={selection => {
          setOrderBy(selection.value);
          trackAnalytics('flags.sort_flags', {
            organization,
            sortMethod: selection.value,
          });
        }}
        options={ORDER_BY_OPTIONS.map(o => {
          const selectionType = getSelectionType(o.value);
          return selectionType !== sortBy ? {...o, disabled: true} : o;
        })}
      />
    </CompositeSelect>
  );
}
