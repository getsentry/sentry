import {Button, type ButtonProps} from 'sentry/components/button';
import {CompositeSelect} from 'sentry/components/compactSelect/composite';
import type {SelectOption} from 'sentry/components/compactSelect/types';
import {IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import useRouter from 'sentry/utils/useRouter';

export enum MonitorSortOrder {
  ASCENDING = '1',
  DESCENDING = '0',
}

export enum MonitorSortOption {
  STATUS = 'status',
  NAME = 'name',
  MUTED = 'muted',
}

const ORDER_OPTIONS = [
  {label: t('Ascending'), value: MonitorSortOrder.ASCENDING},
  {label: t('Descending'), value: MonitorSortOrder.DESCENDING},
];

const SORT_OPTIONS = [
  {label: t('Status'), value: MonitorSortOption.STATUS},
  {label: t('Name'), value: MonitorSortOption.NAME},
  {label: t('Muted'), value: MonitorSortOption.MUTED},
];

interface Props {
  onChangeOrder?: (order: SelectOption<MonitorSortOrder>) => void;
  onChangeSort?: (sort: SelectOption<MonitorSortOption>) => void;
  order?: MonitorSortOrder;
  size?: ButtonProps['size'];
  sort?: MonitorSortOption;
}

export function SortSelector({onChangeOrder, onChangeSort, order, sort, size}: Props) {
  const {replace, location} = useRouter();

  const selectedSort = sort ?? location.query?.sort ?? MonitorSortOption.STATUS;
  const selectedOrder = order ?? location.query?.asc ?? MonitorSortOrder.DESCENDING;

  const defaultOnChange = (newSort: MonitorSortOption, newOrder: MonitorSortOrder) => {
    replace({...location, query: {...location.query, asc: newOrder, sort: newSort}});
  };
  const handleChangeSort =
    onChangeSort ?? (newSort => defaultOnChange(newSort.value, selectedOrder));
  const handleChangeOrder =
    onChangeOrder ?? (newOrder => defaultOnChange(selectedSort, newOrder.value));

  return (
    <CompositeSelect
      trigger={triggerProps => (
        <Button
          {...triggerProps}
          size={size ?? 'xs'}
          aria-label={t('Sort Cron Monitors')}
          icon={<IconSort size="sm" />}
        >
          {SORT_OPTIONS.find(({value}) => value === selectedSort)?.label ?? ''}
        </Button>
      )}
    >
      <CompositeSelect.Region
        aria-label={t('Sort Options')}
        value={selectedSort}
        onChange={handleChangeSort}
        options={SORT_OPTIONS}
      />
      <CompositeSelect.Region
        aria-label={t('Sort Order Options')}
        value={selectedOrder}
        onChange={handleChangeOrder}
        options={ORDER_OPTIONS}
      />
    </CompositeSelect>
  );
}
