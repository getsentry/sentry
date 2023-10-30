import {browserHistory} from 'react-router';

import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import SelectControlWithProps, {
  Option,
} from 'sentry/views/performance/browser/resources/shared/selectControlWithProps';
import {useResourceDomainsQuery} from 'sentry/views/performance/browser/resources/utils/useResourceDomansQuery';
import {SpanMetricsField} from 'sentry/views/starfish/types';

const {SPAN_DOMAIN} = SpanMetricsField;

export function DomainSelector({value}: {value?: string}) {
  const location = useLocation();
  const {data} = useResourceDomainsQuery();

  const options: Option[] = [
    {value: '', label: 'All'},
    ...data.map(domain => ({
      value: domain,
      label: domain,
    })),
  ];

  return (
    <SelectControlWithProps
      inFieldLabel={`${t('Domain')}:`}
      options={options}
      value={value}
      onChange={newValue => {
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            [SPAN_DOMAIN]: newValue?.value,
          },
        });
      }}
    />
  );
}

export default DomainSelector;
