import {CompositeSelect} from 'sentry/components/compactSelect/composite';
import type {SelectOption} from 'sentry/components/compactSelect/types';
import {IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {FormSize} from 'sentry/utils/theme';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

export enum MonitorSortOrder {
  ASCENDING = '1',
  DESCENDING = '0',
}

export enum MonitorSortOption {
  STATUS = 'status',
  NAME = 'name',
  MUTED = 'muted',
}

const ORDERING = {
  [MonitorSortOption.NAME]: [
    {label: t('A \u2192 Z'), value: MonitorSortOrder.ASCENDING},
    {label: t('Z \u2192 A'), value: MonitorSortOrder.DESCENDING},
  ],
  [MonitorSortOption.STATUS]: [
    {label: t('Failing First'), value: MonitorSortOrder.ASCENDING},
    {label: t('Okay First'), value: MonitorSortOrder.DESCENDING},
  ],
  [MonitorSortOption.MUTED]: [
    {label: t('Active First'), value: MonitorSortOrder.ASCENDING},
    {label: t('Muted First'), value: MonitorSortOrder.DESCENDING},
  ],
};

const SORT_OPTIONS = [
  {label: t('Status'), value: MonitorSortOption.STATUS},
  {label: t('Name'), value: MonitorSortOption.NAME},
  {label: t('Muted'), value: MonitorSortOption.MUTED},
];

interface Props {
  onChangeOrder?: (order: SelectOption<MonitorSortOrder>) => void;
  onChangeSort?: (sort: SelectOption<MonitorSortOption>) => void;
  order?: MonitorSortOrder;
  size?: FormSize;
  sort?: MonitorSortOption;
}

export function SortSelector({onChangeOrder, onChangeSort, order, sort, size}: Props) {
  const location = useLocation();
  const navigate = useNavigate();

  const selectedSort =
    sort ?? (location.query?.sort as MonitorSortOption) ?? MonitorSortOption.STATUS;

  const selectedOrder =
    order ?? (location.query?.ascs as MonitorSortOrder) ?? MonitorSortOrder.ASCENDING;

  const defaultOnChange = (newSort: MonitorSortOption, newOrder: MonitorSortOrder) =>
    navigate(
      {...location, query: {...location.query, asc: newOrder, sort: newSort}},
      {replace: true}
    );

  const handleChangeSort =
    onChangeSort ?? (newSort => defaultOnChange(newSort.value, selectedOrder));

  const handleChangeOrder =
    onChangeOrder ?? (newOrder => defaultOnChange(selectedSort, newOrder.value));

  const label = SORT_OPTIONS.find(({value}) => value === selectedSort)?.label ?? '';
  const orderLabel =
    ORDERING[selectedSort].find(({value}) => value === selectedOrder)?.label ?? '';

  return (
    <CompositeSelect
      size={size}
      triggerLabel={`${label} \u2014 ${orderLabel}`}
      triggerProps={{
        prefix: t('Sort By'),
        'aria-label': t('Sort Cron Monitors'),
        icon: <IconSort />,
      }}
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
        options={ORDERING[selectedSort]}
      />
    </CompositeSelect>
  );
}
