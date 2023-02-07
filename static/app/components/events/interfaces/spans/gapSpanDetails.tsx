import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {FlamegraphPreview} from 'sentry/components/profiling/flamegraph/flamegraphPreview';
import {IconProfiling} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {EventTransaction} from 'sentry/types/event';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';
import {useProfiles} from 'sentry/views/profiling/profilesProvider';

import InlineDocs from './inlineDocs';
import {GapSpanType} from './types';

interface GapSpanDetailsProps {
  event: Readonly<EventTransaction>;
  resetCellMeasureCache: () => void;
  span: Readonly<GapSpanType>;
}

export function GapSpanDetails({
  event,
  resetCellMeasureCache,
  span,
}: GapSpanDetailsProps) {
  const organization = useOrganization();
  const profiles = useProfiles();

  if (profiles?.type !== 'resolved') {
    return (
      <InlineDocs
        orgSlug={organization.slug}
        platform={event.sdk?.name || ''}
        projectSlug={event?.projectSlug ?? ''}
        resetCellMeasureCache={resetCellMeasureCache}
      />
    );
  }

  const profileId = event.contexts.profile?.profile_id || '';

  // TODO: target the span's time window
  const target = generateProfileFlamechartRoute({
    orgSlug: organization.slug,
    projectSlug: event?.projectSlug ?? '',
    profileId,
  });

  function handleGoToProfile() {
    trackAdvancedAnalyticsEvent('profiling_views.go_to_flamegraph', {
      organization,
      source: 'missing_instrumentation',
    });
  }

  return (
    <Container>
      <InstructionsContainer>
        <Heading>{t('Requires Manual Instrumentation')}</Heading>
        <p>
          {tct(
            `To manually instrument certain regions of your code, view [docLink:our documentation].`,
            {
              docLink: (
                <ExternalLink href="https://docs.sentry.io/product/performance/getting-started/" />
              ),
            }
          )}
        </p>
        <Heading>{t('A Profile is available for this transaction!')}</Heading>
        <p>
          {t(
            'We have a profile that can give you some additional context on which functions were sampled during this span.'
          )}
        </p>
        <Button
          icon={<IconProfiling />}
          size="sm"
          onClick={handleGoToProfile}
          to={target}
        >
          {t('Go to Profile')}
        </Button>
      </InstructionsContainer>
      <FlamegraphContainer>
        <FlamegraphPreview
          relativeStartTimestamp={span.start_timestamp - event.startTimestamp}
          relativeStopTimestamp={span.timestamp - event.startTimestamp}
        />
      </FlamegraphContainer>
    </Container>
  );
}

const Container = styled('div')`
  display: flex;
  flex-direction: row;
`;

const Heading = styled('h4')`
  font-size: ${p => p.theme.fontSizeLarge};
`;

const InstructionsContainer = styled('div')`
  width: 300px;
`;

const FlamegraphContainer = styled('div')`
  flex: auto;
`;
