import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useSystemSelectorOptions} from 'sentry/views/insights/database/components/useSystemSelectorOptions';
import {SpanMetricsField} from 'sentry/views/insights/types';

const {SPAN_SYSTEM, SPAN_DOMAIN, SPAN_ACTION} = SpanMetricsField;

export function DatabaseSystemSelector() {
  const location = useLocation();
  const navigate = useNavigate();

  // If there is no query parameter for the system, retrieve the current value from the hook instead
  const systemQueryParam = decodeScalar(location.query?.[SPAN_SYSTEM]);
  const {selectedSystem, setSelectedSystem, options, isLoading, isError} =
    useSystemSelectorOptions();

  const system = systemQueryParam ?? selectedSystem;

  return (
    <CompactSelect
      onChange={option => {
        setSelectedSystem(option.value);
        navigate({
          ...location,
          query: {
            ...location.query,
            [SPAN_SYSTEM]: option.value,
            // Reset the table and command since they won't be valid if the DB system changes
            [SPAN_DOMAIN]: undefined,
            [SPAN_ACTION]: undefined,
          },
        });
      }}
      options={options}
      triggerProps={{prefix: t('System')}}
      loading={isLoading}
      disabled={isError || isLoading || options.length <= 1}
      value={system}
    />
  );
}
