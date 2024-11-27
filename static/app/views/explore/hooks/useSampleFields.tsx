import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import {decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

interface Options {
  location: Location;
  navigate: ReturnType<typeof useNavigate>;
}

export type Field = string;

export function useSampleFields(): [Field[], (fields: Field[]) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const options = {location, navigate};

  return useSampleFieldsImpl(options);
}

function useSampleFieldsImpl({
  location,
  navigate,
}: Options): [Field[], (fields: Field[]) => void] {
  const sampleFields = useMemo(() => {
    const fields = decodeList(location.query.field);

    if (fields.length) {
      return fields;
    }

    return ['id', 'project', 'span.op', 'span.description', 'span.duration', 'timestamp'];
  }, [location.query.field]);

  const setSampleFields = useCallback(
    (fields: Field[]) => {
      navigate({
        ...location,
        query: {
          ...location.query,
          field: fields,
        },
      });
    },
    [location, navigate]
  );

  return [sampleFields, setSampleFields];
}
