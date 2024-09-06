import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import emptyStateImg from 'sentry-images/spot/profiling-empty-state.svg';

import {LinkButton} from 'sentry/components/button';
import {SectionHeading} from 'sentry/components/charts/styles';
import InlineDocs from 'sentry/components/events/interfaces/spans/inlineDocs';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {FlamegraphPreview} from 'sentry/components/profiling/flamegraph/flamegraphPreview';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {CanvasView} from 'sentry/utils/profiling/canvasView';
import {colorComponentsToRGBA} from 'sentry/utils/profiling/colors/utils';
import {Flamegraph as FlamegraphModel} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {getProfilingDocsForPlatform} from 'sentry/utils/profiling/platforms';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import {Rect} from 'sentry/utils/profiling/speedscope';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import type {
  MissingInstrumentationNode,
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
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

  const profile = useMemo(() => {
    const threadId = profileGroup.profiles[profileGroup.activeProfileIndex]?.threadId;
    if (!defined(threadId)) {
      return null;
    }
    return profileGroup.profiles.find(p => p.threadId === threadId) ?? null;
  }, [profileGroup.profiles, profileGroup.activeProfileIndex]);

  const transactionHasProfile = useMemo(() => {
    return (node.parent_transaction?.profiles?.length ?? 0) > 0;
  }, [node]);

  const flamegraph = useMemo(() => {
    if (!transactionHasProfile || !profile) {
      return FlamegraphModel.Example();
    }

    return new FlamegraphModel(profile, {});
  }, [transactionHasProfile, profile]);

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

  if (transactionHasProfile) {
    return (
      <FlamegraphThemeProvider>
        {/* If you remove this div, padding between elements will break */}
        <div>
          <ProfilePreviewHeader
            event={event}
            canvasView={canvasView}
            organization={organization}
          />
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
          <ManualInstrumentationInstruction />
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
        resetCellMeasureCache={() => void 0}
        orgSlug={organization.slug}
        platform={event.sdk?.name || ''}
        projectSlug={event?.projectSlug ?? project?.slug ?? ''}
      />
    );
  }

  // At this point we must have a project on a supported
  // platform that has not setup profiling yet
  return <SetupProfiling link={docsLink} />;
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
    trackAnalytics('profiling_views.go_to_flamegraph', {
      organization,
      source: 'performance.missing_instrumentation',
    });
  }

  return (
    <HeaderContainer>
      <HeaderContainer>
        <StyledSectionHeading>{t('Related Profile')}</StyledSectionHeading>
        <QuestionTooltip
          position="top"
          size="sm"
          containerDisplayMode="block"
          title={t(
            'This profile was collected concurrently with the transaction. It displays the relevant stacks and functions for the duration of this span.'
          )}
        />
      </HeaderContainer>
      <LinkButton size="xs" onClick={handleGoToProfile} to={target}>
        {t('View Profile')}
      </LinkButton>
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
    <Container>
      <Image src={emptyStateImg} />
      <InstructionsContainer>
        <h5>{t('With Profiling, we could paint a better picture')}</h5>
        <p>
          {t(
            'Profiles can give you additional context on which functions are sampled at the same time of these spans.'
          )}
        </p>
        <LinkButton size="sm" priority="primary" href={link} external>
          {t('Set Up Profiling')}
        </LinkButton>
        <ManualInstrumentationInstruction />
      </InstructionsContainer>
    </Container>
  );
}

function ManualInstrumentationInstruction() {
  return (
    <SubText>
      {tct(
        `You can also [docLink:manually instrument] certain regions of your code to see span details for future transactions.`,
        {
          docLink: (
            <ExternalLink href="https://docs.sentry.io/product/performance/getting-started/" />
          ),
        }
      )}
    </SubText>
  );
}

const StyledSectionHeading = styled(SectionHeading)`
  color: ${p => p.theme.textColor};
`;

const Container = styled('div')`
  display: flex;
  gap: ${space(2)};
  justify-content: space-between;
  flex-direction: column;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    flex-direction: row-reverse;
  }
`;

const InstructionsContainer = styled('div')`
  > p {
    margin: 0;
  }

  display: flex;
  gap: ${space(3)};
  flex-direction: column;
  align-items: start;
`;

const Image = styled('img')`
  user-select: none;
  width: 420px;
  align-self: center;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    width: 300px;
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    width: 380px;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    width: 420px;
  }
`;

const FlamegraphContainer = styled('div')`
  height: 310px;
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

const HeaderContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: ${space(1)};
`;

const SubText = styled('p')`
  color: ${p => p.theme.subText};
`;
