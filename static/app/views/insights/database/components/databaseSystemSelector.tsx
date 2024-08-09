import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanMetricsField} from 'sentry/views/insights/types';

export function DatabaseSystemSelector() {
  const handleChange = () => {};

  const {data, isLoading, isError} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject({'span.op': 'db'}),

      fields: [SpanMetricsField.SPAN_SYSTEM, 'count()'],
      sorts: [{field: 'count()', kind: 'desc'}],
    },
    'api.starfish.database-system-selector'
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
      disabled={isLoading || isError}
    />
  );
}
