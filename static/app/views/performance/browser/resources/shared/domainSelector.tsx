import {browserHistory} from 'react-router';

import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import SelectControlWithProps, {
  Option,
} from 'sentry/views/performance/browser/resources/shared/selectControlWithProps';
import {useResourceDomainsQuery} from 'sentry/views/performance/browser/resources/utils/useResourceDomansQuery';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {
  EMPTY_OPTION_VALUE,
  EmptyContainer,
} from 'sentry/views/starfish/views/spans/selectors/emptyOption';

const {SPAN_DOMAIN} = SpanMetricsField;

export function DomainSelector({
  value,
  defaultResourceTypes,
}: {
  defaultResourceTypes?: string[];
  value?: string;
}) {
  const location = useLocation();
  const {data} = useResourceDomainsQuery(defaultResourceTypes);

  const options: Option[] = [
    {value: '', label: 'All'},
    {
      value: EMPTY_OPTION_VALUE,
      label: <EmptyContainer>{t('No domain')}</EmptyContainer>,
    },
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
