import {QueryView} from 'sentry/utils/feedback/list/types';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';

export default function useFeedbackListQueryView({
  queryReferrer,
}: {
  queryReferrer: string;
}): QueryView {
  return useLocationQuery({
    fields: {
      queryReferrer,
      end: decodeScalar,
      environment: decodeList,
      field: decodeList,
      per_page: decodeScalar,
      project: decodeList,
      query: decodeScalar,
      start: decodeScalar,
      statsPeriod: decodeScalar,
      utc: decodeScalar,
    },
  });
}
