import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useSystemSelectorOptions} from 'sentry/views/insights/database/components/useSystemSelectorOptions';

export function DatabaseSystemSelector() {
  const location = useLocation();
  const navigate = useNavigate();

  const {selectedSystem, setSelectedSystem, options, isLoading, isError} =
    useSystemSelectorOptions();

  return (
    <CompactSelect
      onChange={option => {
        setSelectedSystem(option.value);
        navigate({...location, query: {...location.query, system: option.value}});
      }}
      options={options}
      triggerProps={{prefix: t('DB System')}}
      loading={isLoading}
      disabled={isError || isLoading || options.length <= 1}
      value={selectedSystem}
    />
  );
}
