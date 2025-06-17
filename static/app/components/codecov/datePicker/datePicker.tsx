import {useSearchParams} from 'react-router-dom';

import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {DateSelector} from 'sentry/components/codecov/datePicker/dateSelector';

export function DatePicker() {
  const {codecovPeriod} = useCodecovContext();
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <DateSelector
      relativeDate={codecovPeriod}
      onChange={newCodecovPeriod => {
        const currentParams = Object.fromEntries(searchParams.entries());
        const updatedParams = {
          ...currentParams,
          codecovPeriod: newCodecovPeriod,
        };
        setSearchParams(updatedParams);
      }}
    />
  );
}
