import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import Trace, {NewTraceView} from 'sentry/views/replays/detail/trace/trace';

import type {ReplayRecord} from '../../types';

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

function TraceFeature({replayRecord}: {replayRecord: ReplayRecord | undefined}) {
  const organization = useOrganization();

  return (
    <Feature
      features={features}
      hookName={undefined}
      organization={organization}
      renderDisabled={PerfDisabled}
    >
      {organization.features.includes('replay-trace-view-v1') ? (
        <NewTraceView replay={replayRecord} />
      ) : (
        <Trace replay={replayRecord} />
      )}
    </Feature>
  );
}

export default TraceFeature;
