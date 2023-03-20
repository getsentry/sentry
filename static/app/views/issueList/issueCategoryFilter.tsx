import {useState} from 'react';

import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';

function IssueCategoryFilter() {
  const items: SelectOption<string>[] = [
    {label: t('All Categories'), value: 'all_categories', textValue: 'all_categories'},
    {label: t('Errors'), value: 'error', textValue: 'error'},
    {label: t('Performance'), value: 'performance', textValue: 'performance'},
  ];
  const [selectedValue, setSelectedValue] = useState<SelectOption<string>>(items[0]);

  const handleChange = option => setSelectedValue(option);

  return (
    <CompactSelect
      options={items}
      value={selectedValue.value}
      onChange={handleChange}
      menuWidth={250}
      size="md"
    />
  );
}

export default IssueCategoryFilter;
