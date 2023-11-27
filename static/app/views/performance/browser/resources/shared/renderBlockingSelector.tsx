import {browserHistory} from 'react-router';

import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import SelectControlWithProps, {
  Option,
} from 'sentry/views/performance/browser/resources/shared/selectControlWithProps';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

const {RESOURCE_RENDER_BLOCKING_STATUS} = SpanMetricsField;

function RenderBlockingSelector({value}: {value?: string}) {
  const location = useLocation();

  const options: Option[] = [
    {value: '', label: 'All'},
    {value: 'non-blocking', label: t('No')},
    {value: 'blocking', label: t('Yes')},
  ];

  return (
    <SelectControlWithProps
      inFieldLabel={`${t('Blocking')}:`}
      options={options}
      value={value}
      onChange={newValue => {
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            [RESOURCE_RENDER_BLOCKING_STATUS]: newValue?.value,
            [QueryParameterNames.SPANS_CURSOR]: undefined,
          },
        });
      }}
    />
  );
}

export default RenderBlockingSelector;
