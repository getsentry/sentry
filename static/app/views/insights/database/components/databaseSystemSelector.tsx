import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';

export function DatabaseSystemSelector() {
  const handleChange = () => {};

  const options = [
    {value: 'PostgreSQL', label: 'PostgreSQL'},
    {value: 'MongoDB', label: 'MongoDB'},
  ];

  return (
    <CompactSelect
      onChange={handleChange}
      options={options}
      title="ffdfd"
      triggerProps={{prefix: t('DB System')}}
      defaultValue={options[0].value}
    />
  );
}
