import type {ReactNode} from 'react';

import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import {getReadableQueryParamsFromLocation} from 'sentry/views/explore/spans/spansQueryParams';

export function MockQueryParamsContextWrapper({
  children,
}: {
  children: ReactNode;
  extrapolate?: boolean;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const queryParams = getReadableQueryParamsFromLocation(location, organization);
  return (
    <QueryParamsContextProvider
      queryParams={queryParams}
      setQueryParams={() => {}}
      isUsingDefaultFields
      shouldManageFields={false}
    >
      {children}
    </QueryParamsContextProvider>
  );
}
