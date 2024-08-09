import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';

export function DatabaseSystemSelector() {
  const handleChange = () => {};

  const {data, isLoading, isError} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject({'span.op': 'db'}),

      fields: ['span.system', 'count()'],
      sorts: [{field: 'count()', kind: 'desc'}],
    },
    'referrer'
  );

  console.dir(data);

  const options = [
    {value: 'PostgreSQL', label: 'PostgreSQL'},
    {value: 'MongoDB', label: 'MongoDB'},
  ];

  return (
    <CompactSelect
      onChange={handleChange}
      options={options}
      triggerProps={{prefix: t('DB System')}}
      defaultValue={options[0].value}
    />
  );
}
