import ErrorBoundary from 'sentry/components/errorBoundary';
import LazyLoad from 'sentry/components/lazyLoad';

type Props = {
  orgSlug: string;
  projectSlug: string;
  replayId: string;
};

export default function EventReplay({replayId, orgSlug, projectSlug}: Props) {
  return (
    <ErrorBoundary mini>
      <LazyLoad
        component={() => import('./replayContent')}
        replaySlug={`${projectSlug}:${replayId}`}
        orgSlug={orgSlug}
      />
    </ErrorBoundary>
  );
}
