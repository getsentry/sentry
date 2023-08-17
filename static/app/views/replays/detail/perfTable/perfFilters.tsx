import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import FiltersGrid from 'sentry/views/replays/detail/filtersGrid';
import usePerfFilters from 'sentry/views/replays/detail/perfTable/usePerfFilters';

type Props = {
  traceRows: undefined | unknown[];
} & ReturnType<typeof usePerfFilters>;

function PerfFilters({getCrumbTypes, selectValue, setFilters}: Props) {
  const crumbTypes = getCrumbTypes();
  return (
    <FiltersGrid>
      <CompactSelect
        disabled={!crumbTypes.length}
        multiple
        onChange={setFilters as (selection: SelectOption<string>[]) => void}
        options={[
          {
            label: t('Type'),
            options: crumbTypes,
          },
        ]}
        size="sm"
        triggerLabel={selectValue?.length === 0 ? t('Any') : null}
        triggerProps={{prefix: t('Filter')}}
        value={selectValue}
      />
    </FiltersGrid>
  );
}

export default PerfFilters;
