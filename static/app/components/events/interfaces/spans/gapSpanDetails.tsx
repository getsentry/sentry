import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {SectionHeading} from 'sentry/components/charts/styles';
import ExternalLink from 'sentry/components/links/externalLink';
import {FlamegraphPreview} from 'sentry/components/profiling/flamegraph/flamegraphPreview';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconProfiling} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {EventTransaction} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {colorComponentsToRGBA} from 'sentry/utils/profiling/colors/utils';
import {Flamegraph as FlamegraphModel} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
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

export function GapSpanDetails({
  event,
  resetCellMeasureCache,
  span,
}: GapSpanDetailsProps) {
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
      <FlamegraphThemeProvider>
        <div>
          <ProfilePreviewHeader
            canvasView={canvasView}
            event={event}
            organization={organization}
          />
          <ProfilePreviewLegend />
          <FlamegraphContainer>
            <FlamegraphPreview
              flamegraph={flamegraph}
              relativeStartTimestamp={relativeStartTimestamp}
              relativeStopTimestamp={relativeStopTimestamp}
              updateFlamegraphView={setCanvasView}
            />
          </FlamegraphContainer>
          <p>
            {tct(
              'You can also [docLink:manually instrument] certain regions of your code to see span details for future transactions.',
              {
                docLink: (
                  <ExternalLink href="https://docs.sentry.io/product/performance/getting-started/" />
                ),
              }
            )}
          </p>
        </div>
      </FlamegraphThemeProvider>
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
      <SetupProfilingInstructions profilingDocsLink={docsLink} />
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
}

interface SetupProfilingInstructionsProps {
  profilingDocsLink: string;
}

function SetupProfilingInstructions({
  profilingDocsLink,
}: SetupProfilingInstructionsProps) {
  return (
    <div>
      <h4>{t('Requires Manual Instrumentation')}</h4>
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
      <h4>{t('With Profiling, we could paint a better picture')}</h4>
      <p>
        {t(
          'Profiles can give you additional context on which functions are sampled at the same time of these spans.'
        )}
      </p>
      <Button
        icon={<IconProfiling />}
        size="sm"
        priority="primary"
        href={profilingDocsLink}
        external
      >
        {t('Set Up Profiling')}
      </Button>
    </div>
  );
}

interface ProfilePreviewProps {
  canvasView: CanvasView<FlamegraphModel> | null;
  event: Readonly<EventTransaction>;
  organization: Organization;
}

function ProfilePreviewHeader({canvasView, event, organization}: ProfilePreviewProps) {
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
    <HeaderContainer>
      <HeaderContainer>
        <SectionHeading>{t('Related Profile')}</SectionHeading>
        <QuestionTooltip
          position="top"
          size="sm"
          containerDisplayMode="block"
          title={t(
            'This profile was collected concurrently with the transaction. It displays the relevant stacks and functions for the duration of this span.'
          )}
        />
      </HeaderContainer>
      <Button icon={<IconProfiling />} size="xs" onClick={handleGoToProfile} to={target}>
        {t('Go to Profile')}
      </Button>
    </HeaderContainer>
  );
}

function ProfilePreviewLegend() {
  const theme = useFlamegraphTheme();
  const applicationFrameColor = colorComponentsToRGBA(
    theme.COLORS.FRAME_APPLICATION_COLOR
  );
  const systemFrameColor = colorComponentsToRGBA(theme.COLORS.FRAME_SYSTEM_COLOR);

  return (
    <Container>
      <LegendItem>
        <LegendMarker color={applicationFrameColor} />
        {t('Application Function')}
      </LegendItem>
      <LegendItem>
        <LegendMarker color={systemFrameColor} />
        {t('System Function')}
      </LegendItem>
    </Container>
  );
}

const FlamegraphContainer = styled('div')`
  height: 300px;
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};
`;

const Container = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1.5)};

  ${FlamegraphContainer} {
    min-width: 300px;
    flex: 1 1 auto;
  }
`;

const LegendItem = styled('span')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(0.5)};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const LegendMarker = styled('span')<{color: string}>`
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 1px;
  background-color: ${p => p.color};
`;

const HeaderContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: ${space(1)};
`;
