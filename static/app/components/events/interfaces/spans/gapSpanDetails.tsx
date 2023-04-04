import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {FlamegraphPreview} from 'sentry/components/profiling/flamegraph/flamegraphPreview';
import {IconProfiling} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {EventTransaction} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {Flamegraph as FlamegraphModel} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {getProfilingDocsForPlatform} from 'sentry/utils/profiling/platforms';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import {Rect} from 'sentry/utils/profiling/speedscope';
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

export const GapSpanDetails = ({
  event,
  resetCellMeasureCache,
  span,
}: GapSpanDetailsProps) => {
  const {projects} = useProjects();
  const project = useMemo(
    () => projects.find(p => p.id === event.projectID),
    [projects, event]
  );

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

  const transactionHasProfile = defined(threadId) && defined(profile);

  const flamegraph = useMemo(() => {
    if (!transactionHasProfile) {
      return FlamegraphModel.Example();
    }

    return new FlamegraphModel(profile, threadId, {});
  }, [transactionHasProfile, profile, threadId]);

  const relativeStartTimestamp = transactionHasProfile
    ? span.start_timestamp - event.startTimestamp
    : 0;
  const relativeStopTimestamp = transactionHasProfile
    ? span.timestamp - event.startTimestamp
    : flamegraph.configSpace.width;

  // Found the profile, render the preview
  if (transactionHasProfile) {
    return (
      <Container>
        <ProfilePreview
          canvasView={canvasView}
          event={event}
          organization={organization}
        />
        <FlamegraphContainer>
          <FlamegraphThemeProvider>
            <FlamegraphPreview
              flamegraph={flamegraph}
              relativeStartTimestamp={relativeStartTimestamp}
              relativeStopTimestamp={relativeStopTimestamp}
              updateFlamegraphView={setCanvasView}
            />
          </FlamegraphThemeProvider>
        </FlamegraphContainer>
      </Container>
    );
  }

  // The event's platform is more accurate than the project
  // so use that first and fall back to the project's platform
  const docsLink =
    getProfilingDocsForPlatform(event.platform) ??
    (project && getProfilingDocsForPlatform(project.platform));

  // This project has received a profile before so they've already
  // set up profiling. No point showing the profiling setup again.
  if (!docsLink || project?.hasProfiles) {
    return (
      <InlineDocs
        orgSlug={organization.slug}
        platform={event.sdk?.name || ''}
        projectSlug={event?.projectSlug ?? project?.slug ?? ''}
        resetCellMeasureCache={resetCellMeasureCache}
      />
    );
  }

  // At this point we must have a project on a supported
  // platform that has not setup profiling yet
  return (
    <Container>
      <SetupProfilingInstructions docsLink={docsLink} />
      <FlamegraphContainer>
        <FlamegraphThemeProvider>
          <FlamegraphPreview
            flamegraph={flamegraph}
            relativeStartTimestamp={relativeStartTimestamp}
            relativeStopTimestamp={relativeStopTimestamp}
            renderText={false}
            updateFlamegraphView={setCanvasView}
          />
        </FlamegraphThemeProvider>
      </FlamegraphContainer>
    </Container>
  );
};

interface SetupProfilingInstructionsProps {
  docsLink: string;
}

const SetupProfilingInstructions = ({docsLink}: SetupProfilingInstructionsProps) => {
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
};

interface ProfilePreviewProps {
  canvasView: CanvasView<FlamegraphModel> | null;
  event: Readonly<EventTransaction>;
  organization: Organization;
}

const ProfilePreview = ({canvasView, event, organization}: ProfilePreviewProps) => {
  const profileId = event.contexts.profile?.profile_id || '';

  // we want to try to go straight to the same config view as the preview
  const query = canvasView?.configView
    ? {
        // TODO: this assumes that profile start timestamp == transaction timestamp
        fov: Rect.encode(canvasView.configView),
        // the flamechart persists some preferences to local storage,
        // force these settings so the view is the same as the preview
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
};

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
