import {Tag} from 'sentry/components/core/badge/tag';
import {
  scoreToStatus,
  STATUS_TEXT,
} from 'sentry/views/insights/browser/webVitals/utils/scoreToStatus';

type Props = {
  score: number;
};

export function PerformanceBadge({score}: Props) {
  const status = scoreToStatus(score);
  return (
    <Tag type={status === 'good' ? 'success' : status === 'bad' ? 'error' : 'warning'}>
      {STATUS_TEXT[status]} {score}
    </Tag>
  );
}
