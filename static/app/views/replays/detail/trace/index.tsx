import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {NewTraceView} from 'sentry/views/replays/detail/trace/trace';
import type {ReplayRecord} from 'sentry/views/replays/types';

interface Props {
  replayRecord: ReplayRecord | undefined;
}

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

export default function TraceFeature({replayRecord}: Props) {
  const organization = useOrganization();

  return (
    <Feature
      features={features}
      hookName={undefined}
      organization={organization}
      renderDisabled={PerfDisabled}
    >
      <TraceWrapper>
        <NewTraceView replay={replayRecord} />
      </TraceWrapper>
    </Feature>
  );
}

const TraceWrapper = styled('div')`
  padding-top: ${space(1)};
  display: flex;
  flex-direction: column;
  height: 100%;
`;
