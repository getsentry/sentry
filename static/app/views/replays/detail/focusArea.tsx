import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import type {Crumb} from 'sentry/types/breadcrumbs';
import {isBreadcrumbTypeDefault} from 'sentry/types/breadcrumbs';
import useActiveReplayTab from 'sentry/utils/replays/hooks/useActiveReplayTab';
import useOrganization from 'sentry/utils/useOrganization';
import Console from 'sentry/views/replays/detail/console';
import DomMutations from 'sentry/views/replays/detail/domMutations';
import IssueList from 'sentry/views/replays/detail/issueList';
import MemoryChart from 'sentry/views/replays/detail/memoryChart';
import NetworkList from 'sentry/views/replays/detail/network';
import Trace from 'sentry/views/replays/detail/trace';

type Props = {};

function getBreadcrumbsByCategory(breadcrumbs: Crumb[], categories: string[]) {
  return breadcrumbs
    .filter(isBreadcrumbTypeDefault)
    .filter(breadcrumb => categories.includes(breadcrumb.category || ''));
}

function FocusArea({}: Props) {
  const {getActiveTab} = useActiveReplayTab();
  const {currentTime, currentHoverTime, replay, setCurrentTime, setCurrentHoverTime} =
    useReplayContext();
  const organization = useOrganization();

  if (!replay) {
    return <Placeholder height="150px" />;
  }

  const replayRecord = replay.getReplay();
  const startTimestampMs = replayRecord.startedAt.getTime();

  switch (getActiveTab()) {
    case 'console':
      const consoleMessages = getBreadcrumbsByCategory(replay?.getRawCrumbs(), [
        'console',
        'exception',
      ]);
      return (
        <Console
          breadcrumbs={consoleMessages ?? []}
          startTimestampMs={replayRecord.startedAt.getTime()}
        />
      );
    case 'network':
      return (
        <NetworkList
          replayRecord={replayRecord}
          networkSpans={replay.getNetworkSpans()}
        />
      );
    case 'trace':
      const features = ['organizations:performance-view'];

      const renderDisabled = () => (
        <FeatureDisabled
          featureName={t('Performance Monitoring')}
          features={features}
          message={t('Requires performance monitoring.')}
          hideHelpToggle
        />
      );
      return (
        <Feature
          organization={organization}
          hookName="feature-disabled:configure-distributed-tracing"
          features={features}
          renderDisabled={renderDisabled}
        >
          <Trace organization={organization} replayRecord={replayRecord} />
        </Feature>
      );
    case 'issues':
      return <IssueList replayId={replayRecord.id} projectId={replayRecord.projectId} />;
    case 'dom':
      return <DomMutations replay={replay} />;
    case 'memory':
      return (
        <MemoryChart
          currentTime={currentTime}
          currentHoverTime={currentHoverTime}
          memorySpans={replay.getMemorySpans()}
          setCurrentTime={setCurrentTime}
          setCurrentHoverTime={setCurrentHoverTime}
          startTimestampMs={startTimestampMs}
        />
      );
    default:
      return null;
  }
}

export default FocusArea;
