import {useCallback} from 'react';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import Trace from 'sentry/views/replays/detail/trace/trace';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  organization: Organization;
  replayRecord: ReplayRecord;
};

const features = ['organizations:performance-view'];

function TraceFeature({organization, replayRecord}: Props) {
  const renderDisabled = useCallback(
    () => (
      <FeatureDisabled
        featureName={t('Performance Monitoring')}
        features={features}
        hideHelpToggle
        message={t('Requires performance monitoring.')}
      />
    ),
    []
  );

  // TODO(replays): Configure an upsell message for when tracing is disabled
  return (
    <Feature
      features={features}
      hookName={undefined}
      organization={organization}
      renderDisabled={renderDisabled}
    >
      <Trace organization={organization} replayRecord={replayRecord} />
    </Feature>
  );
}

export default TraceFeature;
