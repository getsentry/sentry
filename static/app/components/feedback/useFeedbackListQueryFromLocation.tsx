import decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';

export default function useFeedbackListQueryFromLocation() {
  return useLocationQuery({
    fields: {
      limit: 25,
      queryReferrer: 'feedback_list_page',
      end: decodeScalar,
      environment: decodeList,
      field: decodeList,
      project: decodeList,
      query: decodeScalar,
      start: decodeScalar,
      statsPeriod: decodeScalar,
      utc: decodeScalar,
      mailbox: decodeMailbox,
    },
  });
}
