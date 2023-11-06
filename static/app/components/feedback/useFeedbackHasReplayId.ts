import useReplaysCount from 'sentry/components/replays/useReplaysCount';
import {IssueCategory} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  feedbackId: string;
}

export default function useFeedbackHasReplayId({feedbackId}: Props) {
  const organization = useOrganization();
  const counts = useReplaysCount({
    organization,
    issueCategory: IssueCategory.PERFORMANCE, // Feedbacks are in the same dataSource as performance
    groupIds: [feedbackId],
  });
  const hasReplay = Boolean(counts[feedbackId]);
  return hasReplay;
}
