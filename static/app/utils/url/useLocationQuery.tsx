import {useMemo} from 'react';

import {decodeInteger, decodeList, decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';

type Scalar = string | boolean | number | undefined;
type Decoder = typeof decodeList | typeof decodeScalar | typeof decodeInteger;

/**
 * Select and memoize query params from location.
 * This returns a new object only when one of your requested query params is
 * updated, so you won't get re-renders whenever the overall location object
 * changes.
 */
export default function useLocationQuery<
  Fields extends Record<string, Scalar | Scalar[]>,
>({fields}: {fields: Record<keyof Fields, Fields[string] | Decoder>}): Fields {
  const location = useLocation();

  const locationFields = {};
  const staticFields = {};
  Object.entries(fields).forEach(([field, decoderOrValue]) => {
    if (typeof decoderOrValue === 'function') {
      locationFields[field] = decoderOrValue(location.query[field]);
    } else {
      staticFields[field] = decoderOrValue;
    }
  }, {});

  const stringyFields = JSON.stringify(locationFields);
  const objFields = useMemo(() => JSON.parse(stringyFields), [stringyFields]);

  return useMemo(
    () => ({
      ...objFields,
      ...staticFields,
    }),
    [objFields] // eslint-disable-line react-hooks/exhaustive-deps
  );
}
