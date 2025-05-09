import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import emptyStateImg from 'sentry-images/spot/profiling-empty-state.svg';

import {LinkButton} from 'sentry/components/core/button';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {FlamegraphPreview} from 'sentry/components/profiling/flamegraph/flamegraphPreview';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {CanvasView} from 'sentry/utils/profiling/canvasView';
import {colorComponentsToRGBA} from 'sentry/utils/profiling/colors/utils';
import {Flamegraph as FlamegraphModel} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {getProfilingDocsForPlatform} from 'sentry/utils/profiling/platforms';
import {
  generateContinuousProfileFlamechartRouteWithQuery,
  generateProfileFlamechartRouteWithQuery,
} from 'sentry/utils/profiling/routes';
import {Rect} from 'sentry/utils/profiling/speedscope';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {SectionDivider} from 'sentry/views/issueDetails/streamline/foldSection';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {isMissingInstrumentationNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {MissingInstrumentationNode} from 'sentry/views/performance/newTraceDetails/traceModels/missingInstrumentationNode';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';
import {useProfiles} from 'sentry/views/profiling/profilesProvider';

interface SpanProfileProps {
  event: Readonly<EventTransaction>;
  node: TraceTreeNode<TraceTree.Span> | MissingInstrumentationNode;
}

export function ProfilePreview({event, node}: SpanProfileProps) {
  const {projects} = useProjects();
  const profiles = useProfiles();
  const profileGroup = useProfileGroup();
  const project = useMemo(
    () => projects.find(p => p.id === event.projectID),
    [projects, event]
  );

  const organization = useOrganization();
  const [canvasView, setCanvasView] = useState<CanvasView<FlamegraphModel> | null>(null);

  const spanThreadId = useMemo(() => {
    const value = isMissingInstrumentationNode(node)
      ? (node.previous.value ?? node.next.value ?? null)
      : (node.value ?? null);
    return 'data' in value ? value.data?.['thread.id'] : null;
  }, [node]);

  const profile = useMemo(() => {
    if (defined(spanThreadId)) {
      return profileGroup.profiles.find(p => String(p.threadId) === spanThreadId) ?? null;
    }

    const activeThreadId =
      profileGroup.profiles[profileGroup.activeProfileIndex]?.threadId;
    if (defined(activeThreadId)) {
      return profileGroup.profiles.find(p => p.threadId === activeThreadId) ?? null;
    }

    return null;
  }, [profileGroup.profiles, profileGroup.activeProfileIndex, spanThreadId]);

  const transactionHasProfile = useMemo(() => {
    return (TraceTree.ParentTransaction(node)?.profiles?.length ?? 0) > 0;
  }, [node]);

  const flamegraph = useMemo(() => {
    if (!transactionHasProfile || !profile) {
      return FlamegraphModel.Example();
    }

    return new FlamegraphModel(profile, {});
  }, [transactionHasProfile, profile]);

  const target = useMemo(() => {
    if (defined(event?.projectSlug)) {
      const profileContext = event.contexts.profile ?? {};
      if (defined(profileContext.profile_id)) {
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
        return generateProfileFlamechartRouteWithQuery({
          organization,
          projectSlug: event.projectSlug,
          profileId: profileContext.profile_id,
          query,
        });
      }

      if (defined(event) && defined(profileContext.profiler_id)) {
        const query = {
          eventId: event.id,
          tid: spanThreadId,
        };
        return generateContinuousProfileFlamechartRouteWithQuery({
          organization,
          projectSlug: event.projectSlug,
          profilerId: profileContext.profiler_id,
          start: new Date(event.startTimestamp * 1000).toISOString(),
          end: new Date(event.endTimestamp * 1000).toISOString(),
          query,
        });
      }
    }

    return undefined;
  }, [canvasView, event, organization, spanThreadId]);

  // The most recent profile formats should contain a timestamp indicating
  // the beginning of the profile. This timestamp can be after the start
  // timestamp on the transaction, so we need to account for the gap and
  // make sure the relative start timestamps we compute for the span is
  // relative to the start of the profile.
  //
  // If the profile does not contain a timestamp, we fall back to using the
  // start timestamp on the transaction. This won't be as accurate but it's
  // the next best thing.
  const startTimestamp = profile?.timestamp ?? event.startTimestamp;
  const relativeStartTimestamp = transactionHasProfile
    ? node.value.start_timestamp - startTimestamp
    : 0;
  const relativeStopTimestamp = transactionHasProfile
    ? node.value.timestamp - startTimestamp
    : flamegraph.configSpace.width;

  function handleGoToProfile() {
    trackAnalytics('profiling_views.go_to_flamegraph', {
      organization,
      source: 'performance.missing_instrumentation',
    });
  }

  const message = (
    <TextBlock>{t('Or, see if profiling can provide more context on this:')}</TextBlock>
  );

  if (defined(target) && transactionHasProfile) {
    return (
      <FlamegraphThemeProvider>
        {message}
        <SectionDivider />
        <InterimSection
          title={t('Profile')}
          type="no_instrumentation_profile"
          initialCollapse={false}
          actions={
            <LinkButton size="xs" onClick={handleGoToProfile} to={target}>
              {t('Open in Profiling')}
            </LinkButton>
          }
        >
          {/* If you remove this div, padding between elements will break */}
          <div>
            <ProfilePreviewLegend />
            <FlamegraphContainer>
              {profiles.type === 'loading' ? (
                <LoadingIndicator />
              ) : (
                <FlamegraphPreview
                  flamegraph={flamegraph}
                  updateFlamegraphView={setCanvasView}
                  relativeStartTimestamp={relativeStartTimestamp}
                  relativeStopTimestamp={relativeStopTimestamp}
                />
              )}
            </FlamegraphContainer>
          </div>
        </InterimSection>
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
    return null;
  }

  // At this point we must have a project on a supported
  // platform that has not setup profiling yet
  return (
    <Fragment>
      {message}
      <SetupProfiling link={docsLink} />
    </Fragment>
  );
}

const TextBlock = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  line-height: 1.5;
  margin-bottom: ${space(2)};
`;

function ProfilePreviewLegend() {
  const theme = useFlamegraphTheme();
  const applicationFrameColor = colorComponentsToRGBA(
    theme.COLORS.FRAME_APPLICATION_COLOR
  );
  const systemFrameColor = colorComponentsToRGBA(theme.COLORS.FRAME_SYSTEM_COLOR);

  return (
    <LegendContainer>
      <LegendItem>
        <LegendMarker color={applicationFrameColor} />
        {t('Application Function')}
      </LegendItem>
      <LegendItem>
        <LegendMarker color={systemFrameColor} />
        {t('System Function')}
      </LegendItem>
    </LegendContainer>
  );
}

function SetupProfiling({link}: {link: string}) {
  return (
    <Panel>
      <StyledPanelBody>
        <span>
          <h5>{t('Profiling for a Better Picture')}</h5>
          <TextBlock>
            {t(
              'Profiles can also give you additional context on which functions are getting sampled at the time of these spans.'
            )}
          </TextBlock>
          <LinkButton size="sm" priority="primary" href={link} external>
            {t('Get Started')}
          </LinkButton>
        </span>
        <ImageContainer>
          <Image src={emptyStateImg} />
        </ImageContainer>
      </StyledPanelBody>
    </Panel>
  );
}

const Image = styled('img')`
  user-select: none;
  width: 250px;
  align-self: center;
`;

const StyledPanelBody = styled(PanelBody)`
  display: flex;
  gap: ${space(2)};
  justify-content: space-between;
  padding: ${space(2)};
  container-type: inline-size;
`;

const ImageContainer = styled('div')`
  display: flex;
  min-width: 200px;
  justify-content: center;

  @container (max-width: 600px) {
    display: none;
  }
`;

const FlamegraphContainer = styled('div')`
  height: 200px;
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};
  position: relative;
`;

const LegendContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1.5)};
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
