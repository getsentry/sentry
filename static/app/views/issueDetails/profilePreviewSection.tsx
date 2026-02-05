import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {LinkButton} from '@sentry/scraps/button';
import {ExternalLink} from '@sentry/scraps/link';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import ErrorBoundary from 'sentry/components/errorBoundary';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {FlamegraphPreview} from 'sentry/components/profiling/flamegraph/flamegraphPreview';
import QuestionTooltip from 'sentry/components/questionTooltip';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import {EventOrGroupType} from 'sentry/types/event';
import type {PlatformKey, Project} from 'sentry/types/project';
import {Flamegraph as FlamegraphModel} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {generateContinuousProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {
  ProfileGroupProvider,
  useProfileGroup,
} from 'sentry/views/profiling/profileGroupProvider';
import {
  ProfileContext,
  ProfilesProvider,
  useProfiles,
} from 'sentry/views/profiling/profilesProvider';

export function ProfilePreviewSection({
  event,
  project,
}: {
  event: Event;
  project: Project;
}) {
  const organization = useOrganization();
  const profileMeta = useMemo(() => getProfileMetaForEvent(event), [event]);

  const [viewMode, setViewMode] = useState<'aggregated' | 'timeline'>('aggregated');

  if (!organization || !project?.slug) {
    return null;
  }

  if (!profileMeta) {
    return null;
  }

  const isApplePlatform =
    project.platform === 'apple' ||
    project.platform === 'apple-ios' ||
    project.platform === 'apple-macos';

  const mechanism = event.tags?.find(({key}) => key === 'mechanism')?.value;
  const isAnrOrAppHang =
    mechanism === 'ANR' || mechanism === 'AppExitInfo' || mechanism === 'AppHang';
  const sectionTitle = isAnrOrAppHang
    ? isApplePlatform
      ? t('App Hang Profile')
      : t('ANR Profile')
    : t('Profile');

  const openTarget = generateContinuousProfileFlamechartRouteWithQuery({
    organization,
    projectSlug: project.slug,
    profilerId: profileMeta.profiler_id,
    start: profileMeta.start,
    end: profileMeta.end,
  });

  return (
    <ErrorBoundary mini>
      <ProfilesProvider
        orgSlug={organization.slug}
        projectSlug={project.slug}
        profileMeta={profileMeta}
      >
        <ProfileContext.Consumer>
          {profiles => (
            <InterimSection
              type={SectionKey.PROFILE_PREVIEW}
              title={
                <span>
                  {sectionTitle}
                  &nbsp;
                  <QuestionTooltip
                    position="bottom"
                    size="sm"
                    title={t('This shows you a profile around the time of this event.')}
                  />
                </span>
              }
              initialCollapse
              actions={
                profiles?.type === 'resolved' && openTarget ? (
                  <LinkButton size="xs" to={openTarget}>
                    {t('Open in Profiling')}
                  </LinkButton>
                ) : null
              }
            >
              <ProfileGroupProvider
                type={viewMode === 'timeline' ? 'flamechart' : 'flamegraph'}
                input={profiles?.type === 'resolved' ? profiles.data : null}
                traceID={profileMeta.profiler_id || ''}
              >
                <FlamegraphThemeProvider>
                  <InlineFlamegraphPreview
                    platform={project.platform}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                  />
                </FlamegraphThemeProvider>
              </ProfileGroupProvider>
            </InterimSection>
          )}
        </ProfileContext.Consumer>
      </ProfilesProvider>
    </ErrorBoundary>
  );
}

function InlineFlamegraphPreview({
  platform,
  viewMode,
  onViewModeChange,
}: {
  onViewModeChange: (mode: 'aggregated' | 'timeline') => void;
  viewMode: 'aggregated' | 'timeline';
  platform?: PlatformKey | null;
}) {
  const profiles = useProfiles();
  const profileGroup = useProfileGroup();

  const active =
    profileGroup.profiles[profileGroup.activeProfileIndex] ??
    profileGroup.profiles[0] ??
    null;

  const sort: 'left heavy' | 'call order' =
    viewMode === 'timeline' ? 'call order' : 'left heavy';

  const flamegraph = useMemo(
    () => (active ? new FlamegraphModel(active, {sort}) : null),
    [active, sort]
  );

  const currentPlatform = platform ? platforms.find(p => p.id === platform) : undefined;

  const platformLabel = currentPlatform?.name ?? t('your platform');
  const docsUrl = currentPlatform?.link
    ? `${currentPlatform.link}profiling/`
    : 'https://docs.sentry.io/product/profiling/';

  if (profiles.type === 'loading') {
    return (
      <ProfilePreviewContainer>
        <LoadingIndicator />
      </ProfilePreviewContainer>
    );
  }

  if (profiles.type === 'errored') {
    return (
      <Alert.Container>
        <Alert variant="warning" showIcon>
          <p>
            {t("A performance profile was attached to this event, but it wasn't stored.")}
          </p>
          <p>
            {t(
              'This may be due to exceeding your profiling quota, or the profile being sampled out. Ensure your project has profiling quota to see flamegraphs for future events.'
            )}
          </p>
          <p>
            {t('Learn more about Profiling for %s ', platformLabel)}
            <ExternalLink href={docsUrl}>{t('in our documentation')}</ExternalLink>.
          </p>
        </Alert>
      </Alert.Container>
    );
  }

  if (profiles.type !== 'resolved') {
    return null;
  }

  if (!active || !flamegraph) {
    return null;
  }

  const relativeStart = 0;
  const relativeStop = flamegraph.configSpace.width;

  return (
    <div>
      <SegmentedControl
        aria-label={t('Profile view')}
        size="xs"
        value={viewMode}
        onChange={onViewModeChange}
      >
        <SegmentedControl.Item key="aggregated">{t('Left-heavy')}</SegmentedControl.Item>
        <SegmentedControl.Item key="timeline">{t('Time-ordered')}</SegmentedControl.Item>
      </SegmentedControl>
      <ProfilePreviewContainer>
        <FlamegraphPreview
          flamegraph={flamegraph}
          relativeStartTimestamp={relativeStart}
          relativeStopTimestamp={relativeStop}
        />
      </ProfilePreviewContainer>
    </div>
  );
}

function getProfileMetaForEvent(event: Event) {
  const profilerId = event.contexts?.profile?.profiler_id;

  if (!profilerId) {
    return null;
  }

  const timeWindow = getProfileTimeWindow(event);

  if (!timeWindow) {
    return null;
  }

  return {
    profiler_id: profilerId,
    start: timeWindow.start,
    end: timeWindow.end,
  };
}

function getProfileTimeWindow(event: Event): {end: string; start: string} | null {
  if (event.type === EventOrGroupType.TRANSACTION) {
    const transaction = event;

    if (
      typeof transaction.startTimestamp === 'number' &&
      !isNaN(transaction.startTimestamp) &&
      typeof transaction.endTimestamp === 'number' &&
      !isNaN(transaction.endTimestamp)
    ) {
      return {
        end: new Date(transaction.endTimestamp * 1000).toISOString(),
        start: new Date(transaction.startTimestamp * 1000).toISOString(),
      };
    }
  }

  if (!event.dateCreated) {
    return null;
  }

  const eventDate = new Date(event.dateCreated);
  const eventTimeMs = eventDate.getTime();

  // fallback to 10 second window around the event timestamp
  return {
    end: new Date(eventTimeMs + 5_000).toISOString(),
    start: new Date(eventTimeMs - 5_000).toISOString(),
  };
}

const ProfilePreviewContainer = styled('div')`
  height: 200px;
  margin-top: ${space(0.5)};
  position: relative;
`;
