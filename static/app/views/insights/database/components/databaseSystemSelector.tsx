import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {useSystemSelectorOptions} from 'sentry/views/insights/database/components/useSystemSelectorOptions';

export function DatabaseSystemSelector() {
  const {selectedOption, setSelectedOption, options, isLoading, isError} =
    useSystemSelectorOptions();

  return (
    <CompactSelect
      onChange={option => {
        setSelectedOption(option.value);
      }}
      options={options}
      triggerProps={{prefix: t('DB System')}}
      loading={isLoading}
      disabled={isError || isLoading || options.length <= 1}
      value={selectedOption}
    />
  );
}
