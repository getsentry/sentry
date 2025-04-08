import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import type {DateSelectorProps} from 'sentry/components/codecov/dateSelector';
import {DateSelector} from 'sentry/components/codecov/dateSelector';
import {DesyncedFilterMessage} from 'sentry/components/organizations/pageFilters/desyncedFilter';
import {t} from 'sentry/locale';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';

export interface DatePickerProps
  extends Partial<Partial<Omit<DateSelectorProps, 'relative' | 'menuBody'>>> {}

export function DatePicker({
  onChange,
  menuTitle,
  menuWidth,
  triggerProps = {},
  ...selectProps
}: DatePickerProps) {
  const router = useRouter();
  const {selection, desyncedFilters} = usePageFilters();
  const desynced = desyncedFilters.has('datetime');
  const period = selection.datetime?.period;

  return (
    <DateSelector
      {...selectProps}
      relative={period}
      desynced={desynced}
      onChange={timePeriodUpdate => {
        const {relative} = timePeriodUpdate;
        const newTimePeriod = {period: relative};

        onChange?.(timePeriodUpdate);
        updateDateTime(newTimePeriod, router, {
          save: true,
        });
      }}
      menuTitle={menuTitle ?? t('Filter Time Range')}
      menuWidth={(menuWidth ?? desynced) ? '22em' : undefined}
      menuBody={desynced && <DesyncedFilterMessage />}
      triggerProps={triggerProps}
    />
  );
}
