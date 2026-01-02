import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import {useTTFDConfigured} from 'sentry/views/insights/common/queries/useHasTtfdConfigured';
import {useAffectsSelection} from 'sentry/views/insights/mobile/screenload/data/useAffectsSelection';

export function AffectSelector({transaction}: {transaction?: string}) {
  const {value, setValue} = useAffectsSelection();
  const {hasTTFD} = useTTFDConfigured([`transaction:"${transaction}"`]);

  const options: Array<SelectOption<'TTID' | 'TTFD' | 'NONE' | 'ALL'>> = [
    {value: 'ALL', label: t('All')},
    {value: 'TTID', label: t('TTID')},
  ];

  if (hasTTFD) {
    options.push({value: 'TTFD', label: t('TTFD')});
  }

  options.push({value: 'NONE', label: t('None')});

  return (
    <CompactSelect
      triggerProps={{prefix: t('Affects'), size: 'md'}}
      value={value}
      options={options}
      onChange={newValue => {
        setValue(newValue.value);
      }}
    />
  );
}
