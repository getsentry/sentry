import {Button} from 'sentry/components/button';
import {CompositeSelect} from 'sentry/components/compactSelect/composite';
import type {SelectOption} from 'sentry/components/compactSelect/types';
import {IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import useRouter from 'sentry/utils/useRouter';

export enum MonitorSortOrder {
  ASCENDING = 'ascending',
  DESCENDING = 'descending',
}

export enum MonitorSortOptions {
  STATE = 'state',
  NAME = 'name',
  MUTED = 'muted',
}

const ORDER_OPTIONS = [
  {label: t('Ascending'), value: MonitorSortOrder.ASCENDING},
  {label: t('Descending'), value: MonitorSortOrder.DESCENDING},
];

const SORT_OPTIONS = [
  {label: t('State'), value: MonitorSortOptions.STATE},
  {label: t('Name'), value: MonitorSortOptions.NAME},
  {label: t('Muted'), value: MonitorSortOptions.MUTED},
];

interface Props {
  onChangeOrder: (order: SelectOption<MonitorSortOrder>) => void;
  onChangeSort: (sort: SelectOption<MonitorSortOptions>) => void;
  order?: MonitorSortOrder;
  sort?: MonitorSortOptions;
}

export function SortSelector({onChangeOrder, onChangeSort, order, sort}: Props) {
  const {location} = useRouter();

  const selectedSort = sort ?? location.query?.monitorSort ?? MonitorSortOptions.STATE;
  const selectedOrder =
    order ?? location.query?.monitorSortOrder ?? MonitorSortOrder.DESCENDING;

  return (
    <CompositeSelect
      trigger={triggerProps => (
        <Button
          {...triggerProps}
          size="xs"
          aria-label={t('Sort Cron Monitors')}
          icon={<IconSort size="sm" />}
        >
          {SORT_OPTIONS.find(({value}) => value === selectedSort)?.label ?? ''}
        </Button>
      )}
    >
      <CompositeSelect.Region
        value={selectedSort}
        onChange={onChangeSort}
        options={SORT_OPTIONS}
      />
      <CompositeSelect.Region
        value={selectedOrder}
        onChange={onChangeOrder}
        options={ORDER_OPTIONS}
      />
    </CompositeSelect>
  );
}
