import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import ErrorBoundary from 'sentry/components/errorBoundary';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {FlamegraphPreview} from 'sentry/components/profiling/flamegraph/flamegraphPreview';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import {EventOrGroupType} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
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

export function FlameGraphSection({event, project}: {event: Event; project: Project}) {
  const organization = useOrganization();
  const profileMeta = useMemo(() => getProfileMetaForEvent(event), [event]);

  if (!organization || !project?.slug) {
    return null;
  }

  if (!profileMeta) {
    return null;
  }

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
        <InterimSection
          type={SectionKey.FLAME_GRAPH}
          title={
            <span>
              {t('Aggregated Flamegraph')}
              &nbsp;
              <QuestionTooltip
                position="bottom"
                size="sm"
                title={t(
                  'Aggregate flamegraphs are a visual representation of stacktraces that helps identify where a program spends its time. Look for the widest stacktraces as they indicate where your application is spending more time.'
                )}
              />
            </span>
          }
          initialCollapse
          actions={
            <ProfileContext.Consumer>
              {profiles =>
                profiles?.type === 'resolved' && openTarget ? (
                  <LinkButton size="xs" to={openTarget}>
                    {t('Open in Profiling')}
                  </LinkButton>
                ) : null
              }
            </ProfileContext.Consumer>
          }
        >
          <ProfileContext.Consumer>
            {profiles => (
              <ProfileGroupProvider
                type="flamegraph"
                input={profiles?.type === 'resolved' ? profiles.data : null}
                traceID={profileMeta.profiler_id || ''}
              >
                <FlamegraphThemeProvider>
                  <InlineFlamegraphPreview />
                </FlamegraphThemeProvider>
              </ProfileGroupProvider>
            )}
          </ProfileContext.Consumer>
        </InterimSection>
      </ProfilesProvider>
    </ErrorBoundary>
  );
}

function InlineFlamegraphPreview() {
  const profiles = useProfiles();
  const profileGroup = useProfileGroup();

  const active =
    profileGroup.profiles[profileGroup.activeProfileIndex] ??
    profileGroup.profiles[0] ??
    null;
  const flamegraph = useMemo(
    () => (active ? new FlamegraphModel(active, {sort: 'left heavy'}) : null),
    [active]
  );

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
        <Alert type="warning" showIcon>
          {t(
            'We couldn’t load the profile attached to this event. It may have been sampled out.'
          )}
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
      typeof transaction.endTimestamp === 'number'
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
