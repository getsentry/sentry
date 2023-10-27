import decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import type {Organization} from 'sentry/types';
import type {ApiQueryKey} from 'sentry/utils/queryClient';

type QueryView = {
  end: string;
  environment: string[];
  field: string[];
  limit: number;
  mailbox: ReturnType<typeof decodeMailbox>;
  project: string[];
  query: string;
  queryReferrer: string;
  start: string;
  statsPeriod: string;
  utc: string;
};

interface Props {
  organization: Organization;
  queryView: QueryView;
}

export default function getFeedbackListQueryKey({
  organization,
  queryView,
}: Props): ApiQueryKey {
  return [
    `/organizations/${organization.slug}/issues/`,
    {
      query: {
        ...queryView,
        collapse: ['inbox'],
        expand: [
          'owners', // Gives us assignment
          'stats', // Gives us `firstSeen`
        ],
        shortIdLookup: 0,
        query: `issue.category:feedback status:${queryView.mailbox} ${queryView.query}`,
      },
    },
  ];
}
