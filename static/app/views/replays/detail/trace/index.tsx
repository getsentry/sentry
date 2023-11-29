import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import Trace from 'sentry/views/replays/detail/trace/trace';

function PerfDisabled() {
  return (
    <FeatureDisabled
      featureName={t('Performance Monitoring')}
      features="organizations:performance-view"
      hideHelpToggle
      message={t('Requires performance monitoring.')}
    />
  );
}

function TraceFeature() {
  const organization = useOrganization();
  const {replay} = useReplayContext();
  const replayRecord = replay?.getReplay();

  return (
    <Feature
      feature="organizations:performance-view"
      hookName={undefined}
      organization={organization}
      renderDisabled={PerfDisabled}
    >
      <Trace replayRecord={replayRecord} />
    </Feature>
  );
}

export default TraceFeature;
