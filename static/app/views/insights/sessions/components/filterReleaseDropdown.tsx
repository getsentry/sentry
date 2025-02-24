import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import usePageFilters from 'sentry/utils/usePageFilters';

export default function FilterReleaseDropdown({
  filters,
  setFilters,
}: {
  filters: string[];
  setFilters: (filters: string[]) => void;
}) {
  const {
    selection: {environments},
  } = usePageFilters();

  const finalized = ['Not Finalized', 'Finalized'];
  const status = ['Active', 'Archived'];
  const stage = ['Adopted', 'Replaced', 'Low Adoption'];

  const arrayToOptions = (array: string[]) =>
    array.map(item => ({
      value: item,
      label: item,
    }));

  const handleValueChange = (newValues: any) => {
    setFilters(newValues.map((value: any) => value.value));
  };

  const isDisabled = environments.length !== 1;

  const options = [
    {
      key: 'finalized',
      label: t('Finalized'),
      options: arrayToOptions(finalized),
    },
    {
      key: 'status',
      label: t('Status'),
      options: arrayToOptions(status),
    },
    {
      key: 'stage',
      label: t('Stage'),
      options: arrayToOptions(stage),
      disabled: isDisabled,
      tooltipOptions: {position: 'left'},
      tooltip: isDisabled
        ? t('Please select a single environment to filter by stage')
        : undefined,
    },
  ];

  return (
    <CompactSelect
      position="right"
      triggerProps={{
        prefix: t('Filter'),
      }}
      value={filters}
      onChange={handleValueChange}
      options={options}
      multiple
      clearable
    />
  );
}
