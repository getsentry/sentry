import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {t} from 'sentry/locale';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
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
  const replay = useReplayReader();

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
