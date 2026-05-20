import {useMemo} from 'react';

import {Link} from '@sentry/scraps/link';

import {tct} from 'sentry/locale';
import {updateNullableLocation} from 'sentry/utils/url/updateNullableLocation';
import {useLocation} from 'sentry/utils/useLocation';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getTargetWithReadableQueryParams} from 'sentry/views/explore/spans/spansQueryParams';

const SPANS_TABLE_KEY = 'table';

export function SamplesModeAggregateFilterWarning() {
  const location = useLocation();

  const target = useMemo(() => {
    const nextLocation = getTargetWithReadableQueryParams(location, {
      mode: Mode.AGGREGATE,
    });
    updateNullableLocation(nextLocation, SPANS_TABLE_KEY, null);
    return nextLocation;
  }, [location]);

  return tct(
    "This key won't affect the results because samples mode does not support aggregate functions. [link:View aggregates]",
    {
      link: <Link to={target} />,
    }
  );
}
