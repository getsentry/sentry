import {useMemo} from 'react';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import type {RawCrumb} from 'sentry/types/breadcrumbs';
import {isBreadcrumbTypeDefault} from 'sentry/types/breadcrumbs';
import useActiveReplayTab from 'sentry/utils/replays/hooks/useActiveReplayTab';
import useOrganization from 'sentry/utils/useOrganization';

import Console from './console';
import DomMutations from './domMutations';
import IssueList from './issueList';
import MemoryChart from './memoryChart';
import NetworkList from './network';
import Trace from './trace';

type Props = {};

function getBreadcrumbsByCategory(breadcrumbs: RawCrumb[], categories: string[]) {
  return breadcrumbs
    .filter(isBreadcrumbTypeDefault)
    .filter(breadcrumb => categories.includes(breadcrumb.category || ''));
}

function FocusArea({}: Props) {
  const {getActiveTab} = useActiveReplayTab();
  const {currentTime, currentHoverTime, replay, setCurrentTime, setCurrentHoverTime} =
    useReplayContext();
  const organization = useOrganization();

  // Memoize this because re-renders will interfere with the mouse state of the
  // chart (e.g. on mouse over and out)
  const memorySpans = useMemo(() => {
    return replay?.getRawSpans().filter(replay.isMemorySpan);
  }, [replay]);

  if (!replay || !memorySpans) {
    return <Placeholder height="150px" />;
  }

  const event = replay.getEvent();

  const getNetworkSpans = () => {
    return replay.getRawSpans().filter(replay.isNotMemorySpan);
  };

  switch (getActiveTab()) {
    case 'console':
      const consoleMessages = getBreadcrumbsByCategory(replay?.getRawCrumbs(), [
        'console',
        'exception',
      ]);
      return (
        <Console
          breadcrumbs={consoleMessages ?? []}
          startTimestamp={event?.startTimestamp}
        />
      );
    case 'network':
      return <NetworkList event={event} networkSpans={getNetworkSpans()} />;
    case 'trace':
      const features = ['organizations:performance-view'];

      const renderDisabled = () => (
        <FeatureDisabled
          featureName={t('Performance monitoring')}
          features={features}
          message={t('Requires Performance monitoring.')}
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
          <Trace organization={organization} event={event} />
        </Feature>
      );
    case 'issues':
      return <IssueList replayId={event.id} projectId={event.projectID} />;
    case 'dom':
      return <DomMutations replay={replay} />;
    case 'memory':
      return (
        <MemoryChart
          currentTime={currentTime}
          currentHoverTime={currentHoverTime}
          memorySpans={memorySpans}
          setCurrentTime={setCurrentTime}
          setCurrentHoverTime={setCurrentHoverTime}
          startTimestamp={event?.startTimestamp}
        />
      );
    default:
      return null;
  }
}

export default FocusArea;
