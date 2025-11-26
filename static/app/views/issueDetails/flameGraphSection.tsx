import {useMemo} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import ErrorBoundary from 'sentry/components/errorBoundary';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {FlamegraphPreview} from 'sentry/components/profiling/flamegraph/flamegraphPreview';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {Flamegraph as FlamegraphModel} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
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
  const profilerId = event.contexts?.profile?.profiler_id ?? undefined;
  const timestamp: string | undefined = event.dateCreated ?? undefined;
  const profileMeta = useMemo(() => {
    if (!profilerId) {
      return null;
    }

    // TODO if event is transaction, use transaction timestamps instead
    if (!timestamp) {
      return null;
    }

    // TODO: Events don't seem to have a duration, but it's required for querying the profile.
    // We'll use a 10 second window around the event timestamp for now.
    const start = new Date(timestamp).getTime() - 10_000;
    const end = new Date(timestamp).getTime() + 10_000;
    return {
      profiler_id: profilerId,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
    };
  }, [profilerId, timestamp]);

  if (!organization || !project?.slug) {
    return null;
  }

  if (!profilerId) {
    return null;
  }

  if (!profileMeta) {
    return null;
  }

  let openTarget: import('history').LocationDescriptor | string | undefined = undefined;
  openTarget = generateProfileFlamechartRoute({
    organization,
    projectSlug: project.slug,
    profileId: profilerId,
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
              {t('Aggregated Flamegraph ')}
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
                traceID={profilerId ?? profilerId ?? ''}
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
      <p>
        <span>
          {t(
            'A profile was attached to this event, but could not be loaded. This could be caused by the profile being dropped due to sampling.'
          )}
        </span>
      </p>
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

const ProfilePreviewContainer = styled('div')`
  height: 200px;
  margin-top: ${space(0.5)};
  position: relative;
`;
