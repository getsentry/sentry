import {useMemo} from 'react';

import {Link} from '@sentry/scraps/link';

import {tct} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {getTargetWithReadableQueryParams} from 'sentry/views/explore/spans/spansQueryParams';

export function SamplesModeAggregateFilterWarning() {
  const location = useLocation();

  const target = useMemo(() => {
    const nextLocation = getTargetWithReadableQueryParams(location, {
      mode: Mode.AGGREGATE,
    });
    delete nextLocation.query.table;
    return nextLocation;
  }, [location]);

  return tct(
    "This key won't affect the results because samples mode does not support aggregate functions. [link:View aggregates]",
    {
      link: <Link to={target} />,
    }
  );
}
