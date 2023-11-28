import {useCallback} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import Section from 'sentry/components/feedback/feedbackItem/feedbackItemSection';
import LazyLoad from 'sentry/components/lazyLoad';
import ReplayIdCountProvider from 'sentry/components/replays/replayIdCountProvider';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';

interface Props {
  eventTimestampMs: number;
  organization: Organization;
  replayId: string;
}

export default function ReplaySection({eventTimestampMs, organization, replayId}: Props) {
  const replayPreview = useCallback(
    () => import('sentry/components/events/eventReplay/replayPreview'),
    []
  );

  return (
    <Section icon={<IconPlay size="xs" />} title={t('Linked Replay')}>
      <ErrorBoundary mini>
        <ReplayIdCountProvider organization={organization} replayIds={[replayId]}>
          <LazyLoad
            component={replayPreview}
            eventTimestampMs={eventTimestampMs}
            focusTab={TabKey.BREADCRUMBS}
            orgSlug={organization.slug}
            replaySlug={replayId}
            buttonProps={{
              analyticsEventKey: 'feedback_details.open_replay_details_clicked',
              analyticsEventName: 'Feedback Details: Open Replay Details Clicked',
              analyticsParams: {
                organization,
              },
            }}
          />
        </ReplayIdCountProvider>
      </ErrorBoundary>
    </Section>
  );
}
