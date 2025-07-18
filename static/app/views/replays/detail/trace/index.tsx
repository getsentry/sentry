import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {NewTraceView} from 'sentry/views/replays/detail/trace/trace';

const features = ['organizations:performance-view'];

function PerfDisabled() {
  return (
    <FeatureDisabled
      featureName={t('Performance Monitoring')}
      features={features}
      hideHelpToggle
      message={t('Requires performance monitoring.')}
    />
  );
}

export default function TraceFeature() {
  const organization = useOrganization();
  const {replay} = useReplayContext();

  return (
    <Feature
      features={features}
      hookName={undefined}
      organization={organization}
      renderDisabled={PerfDisabled}
    >
      <NewTraceView replay={replay?.getReplay()} />
    </Feature>
  );
}
