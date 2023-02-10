import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {FlamegraphPreview} from 'sentry/components/profiling/flamegraph/flamegraphPreview';
import {getDocsPlatformSDKForPlatform} from 'sentry/components/profiling/ProfilingOnboarding/util';
import {PlatformKey} from 'sentry/data/platformCategories';
import {IconProfiling} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {EventTransaction} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {Flamegraph as FlamegraphModel} from 'sentry/utils/profiling/flamegraph';
import {Rect} from 'sentry/utils/profiling/gl/utils';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';

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
  const {projects} = useProjects({slugs: event.projectSlug ? [event.projectSlug] : []});
  const projectHasProfile = projects?.[0]?.hasProfiles;

  const organization = useOrganization();
  const [canvasView, setCanvasView] = useState<CanvasView<FlamegraphModel> | null>(null);

  const profileGroup = useProfileGroup();

  const threadId = useMemo(
    () => profileGroup.profiles[profileGroup.activeProfileIndex]?.threadId,
    [profileGroup]
  );

  const profile = useMemo(() => {
    if (!defined(threadId)) {
      return null;
    }
    return profileGroup.profiles.find(p => p.threadId === threadId) ?? null;
  }, [profileGroup.profiles, threadId]);

  const hasProfile = defined(threadId) && defined(profile);

  const flamegraph = useMemo(() => {
    if (!hasProfile) {
      return FlamegraphModel.Example();
    }

    return new FlamegraphModel(profile, threadId, {});
  }, [hasProfile, profile, threadId]);

  const relativeStartTimestamp = hasProfile
    ? span.start_timestamp - event.startTimestamp
    : 0;
  const relativeStopTimestamp = hasProfile
    ? span.timestamp - event.startTimestamp
    : flamegraph.configSpace.width;

  const docsPlatform = getDocsPlatformSDKForPlatform(event.platform);

  if (
    // profiling isn't supported for this platform
    !docsPlatform ||
    // the project already sent a profile but this transaction doesnt have a profile
    (projectHasProfile && !hasProfile)
  ) {
    return (
      <InlineDocs
        orgSlug={organization.slug}
        platform={event.sdk?.name || ''}
        projectSlug={event?.projectSlug ?? ''}
        resetCellMeasureCache={resetCellMeasureCache}
      />
    );
  }

  return (
    <Container>
      {!projectHasProfile && <SetupProfilingInstructions docsPlatform={docsPlatform} />}
      {projectHasProfile && hasProfile && (
        <ProfilePreview
          canvasView={canvasView}
          event={event}
          organization={organization}
        />
      )}
      <FlamegraphContainer>
        <FlamegraphPreview
          flamegraph={flamegraph}
          relativeStartTimestamp={relativeStartTimestamp}
          relativeStopTimestamp={relativeStopTimestamp}
          renderText={hasProfile}
          updateFlamegraphView={setCanvasView}
        />
      </FlamegraphContainer>
    </Container>
  );
}

interface SetupProfilingInstructionsProps {
  docsPlatform: PlatformKey;
}

function SetupProfilingInstructions({docsPlatform}: SetupProfilingInstructionsProps) {
  // ios is the only supported apple platform right now
  const docsLink =
    docsPlatform === 'apple-ios'
      ? 'https://docs.sentry.io/platforms/apple/guides/ios/profiling/'
      : `https://docs.sentry.io/platforms/${docsPlatform}/profiling/`;

  return (
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
      <Heading>{t('With Profiling, we could paint a better picture')}</Heading>
      <p>
        {t(
          'Profiles can give you additional context on which functions are sampled at the same time of these spans.'
        )}
      </p>
      <Button
        icon={<IconProfiling />}
        size="sm"
        priority="primary"
        href={docsLink}
        external
      >
        {t('Set Up Profiling')}
      </Button>
    </InstructionsContainer>
  );
}

interface ProfilePreviewProps {
  canvasView: CanvasView<FlamegraphModel> | null;
  event: Readonly<EventTransaction>;
  organization: Organization;
}

function ProfilePreview({canvasView, event, organization}: ProfilePreviewProps) {
  const profileId = event.contexts.profile?.profile_id || '';

  // we want to try to go straight to the same config view as the preview
  const query = canvasView?.configView
    ? {
        fov: Rect.encode(canvasView.configView),
        // the flamechart persists some preferences to local storage,
        // force these settings so the view is the same as the preview
        xAxis: 'profile',
        view: 'top down',
        type: 'flamechart',
      }
    : undefined;

  const target = generateProfileFlamechartRouteWithQuery({
    orgSlug: organization.slug,
    projectSlug: event?.projectSlug ?? '',
    profileId,
    query,
  });

  function handleGoToProfile() {
    trackAdvancedAnalyticsEvent('profiling_views.go_to_flamegraph', {
      organization,
      source: 'performance.missing_instrumentation',
    });
  }

  return (
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
      <Button icon={<IconProfiling />} size="sm" onClick={handleGoToProfile} to={target}>
        {t('Go to Profile')}
      </Button>
    </InstructionsContainer>
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
