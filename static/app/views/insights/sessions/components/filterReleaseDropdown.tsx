import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
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

  const finalizedOptions = [t('Not Finalized'), t('Finalized')];
  const statusOptions = [t('Open'), t('Archived')];
  const stageOptions = [t('Adopted'), t('Replaced'), t('Low Adoption')];

  const arrayToOptions = ({
    array,
    showTooltip,
    tooltip,
  }: {
    array: string[];
    showTooltip?: boolean;
    tooltip?: string;
  }) =>
    array.map(item => ({
      value: item,
      label: item,
      tooltip: showTooltip ? tooltip : undefined,
    }));

  const handleValueChange = (newValues: Array<SelectOption<string>>) => {
    setFilters(newValues.map((value: SelectOption<string>) => value.value));
  };

  const isDisabled = environments.length !== 1;

  const options = [
    {
      key: 'finalized',
      label: t('Finalized'),
      options: arrayToOptions({array: finalizedOptions}),
    },
    {
      key: 'status',
      label: t('Status'),
      options: arrayToOptions({array: statusOptions}),
    },
    {
      key: 'stage',
      label: t('Stage'),
      options: arrayToOptions({
        array: stageOptions,
        showTooltip: isDisabled,
        tooltip: t('Please select a single environment to filter by stage'),
      }),
      disabled: isDisabled,
    },
  ];

  return (
    <CompactSelect
      position="right"
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} prefix={t('Filter')} />
      )}
      value={filters}
      onChange={handleValueChange}
      options={options}
      multiple
      clearable
    />
  );
}
