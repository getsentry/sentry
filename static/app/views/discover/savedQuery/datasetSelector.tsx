import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

const DATASET_PARAM = 'query_dataset';

export function DatasetSelector() {
  const location = useLocation();
  const navigate = useNavigate();
  const value = decodeScalar(location.query[DATASET_PARAM]) ?? 'errors';

  const options = [
    {value: 'errors', label: t('Errors')},
    {value: 'transactions-like', label: t('Transactions')},
  ];

  return (
    <CompactSelect
      triggerProps={{prefix: t('Dataset')}}
      value={value}
      options={options}
      onChange={newValue => {
        navigate({
          ...location,
          query: {...location.query, [DATASET_PARAM]: newValue.value},
        });
      }}
      size="sm"
    />
  );
}
