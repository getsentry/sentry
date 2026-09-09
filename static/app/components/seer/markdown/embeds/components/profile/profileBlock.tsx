import {useMemo, useState, type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {FlamegraphPreview} from 'sentry/components/profiling/flamegraph/flamegraphPreview';
import {ProfileLink} from 'sentry/components/seer/markdown/embeds/components/profile/profileLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {Version} from 'sentry/components/version';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {CanvasView} from 'sentry/utils/profiling/canvasView';
import {Flamegraph as FlamegraphModel} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {
  isSchema,
  isSentryContinuousProfileChunk,
  isSentrySampledProfile,
} from 'sentry/utils/profiling/guards/profile';
import {importProfile} from 'sentry/utils/profiling/profile/importProfile';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import {Rect} from 'sentry/utils/profiling/speedscope';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * The flamechart canvas is absolutely positioned at 100%/100%, so the element
 * wrapping it has to be `position: relative` with an explicit pixel height or
 * nothing is painted.
 */
const PREVIEW_HEIGHT = '200px';

type ViewMode = 'aggregated' | 'timeline';

function profileApiOptions({
  organizationSlug,
  profileId,
  projectSlug,
}: {
  organizationSlug: string;
  profileId: string;
  projectSlug: string;
}) {
  return apiOptions.as<Profiling.ProfileInput>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/profiling/profiles/$profileId/',
    {
      path: {
        organizationIdOrSlug: organizationSlug,
        projectIdOrSlug: projectSlug,
        profileId,
      },
      staleTime: 60_000,
    }
  );
}

interface ProfileMetadata {
  device: string | undefined;
  environment: string | undefined;
  os: string | undefined;
  receivedAt: string | undefined;
  release: string | undefined;
  transactionName: string | undefined;
}

function joinDefined(parts: Array<string | undefined>): string | undefined {
  const joined = parts.filter(Boolean).join(' ');
  return joined || undefined;
}

/**
 * Everything the metadata strip shows comes out of the single profile payload
 * we already fetched -- deliberately no `useProfileEvents`/`useProfileFunctions`,
 * which resolve their scope from the host page's filters rather than this profile.
 */
function getProfileMetadata(input: Profiling.ProfileInput): ProfileMetadata | null {
  if (isSentryContinuousProfileChunk(input)) {
    // A continuous chunk is addressed by profiler id + time range, which this
    // embed's schema does not carry. Nothing reliable to show.
    return null;
  }

  if (isSchema(input)) {
    const {metadata} = input;
    return {
      device: joinDefined([metadata.deviceModel, metadata.deviceClassification]),
      environment: metadata.environment,
      os: joinDefined([metadata.deviceOSName, metadata.deviceOSVersion]),
      receivedAt: metadata.timestamp ?? metadata.received,
      release: metadata.release?.version,
      transactionName: metadata.transactionName,
    };
  }

  if (isSentrySampledProfile(input)) {
    return {
      device: joinDefined([input.device?.manufacturer, input.device?.model]),
      environment: input.environment,
      os: joinDefined([input.os?.name, input.os?.version]),
      receivedAt: input.timestamp ?? input.received,
      release: input.release?.version,
      transactionName: input.transaction?.name,
    };
  }

  return null;
}

function MetadataItem({label, children}: {children: ReactNode; label: string}) {
  return (
    <Stack gap="xs" minWidth="0">
      <Text bold size="xs" uppercase variant="muted">
        {label}
      </Text>
      <Text ellipsis>{children}</Text>
    </Stack>
  );
}

export default function ProfileBlock({projectSlug, profileId}: EmbedOutput<'profile'>) {
  const organization = useOrganization();
  // Local to the embed on purpose: toggling the view must not touch the host
  // conversation's URL or history.
  const [viewMode, setViewMode] = useState<ViewMode>('aggregated');
  const [canvasView, setCanvasView] = useState<CanvasView<FlamegraphModel> | null>(null);

  const {data, isError, isPending} = useQuery({
    ...profileApiOptions({organizationSlug: organization.slug, projectSlug, profileId}),
    retry: false,
  });

  const metadata = useMemo(() => (data ? getProfileMetadata(data) : null), [data]);

  // `importProfile` is real CPU work over the whole payload, so keep it memoized.
  const profileGroup = useMemo(() => {
    if (!data || isSentryContinuousProfileChunk(data)) {
      return null;
    }

    try {
      return importProfile(
        data,
        isSchema(data) ? data.metadata.traceID : '',
        null,
        viewMode === 'timeline' ? 'flamechart' : 'flamegraph'
      );
    } catch {
      // An unrecognized payload degrades to the metadata strip below.
      return null;
    }
  }, [data, viewMode]);

  const activeProfile =
    profileGroup?.profiles[profileGroup.activeProfileIndex] ??
    profileGroup?.profiles[0] ??
    null;

  const flamegraph = useMemo(
    () =>
      activeProfile
        ? new FlamegraphModel(activeProfile, {
            sort: viewMode === 'timeline' ? 'call order' : 'left heavy',
          })
        : null,
    [activeProfile, viewMode]
  );

  const target = useMemo(() => {
    // Deep link to the same viewport the preview is showing.
    const query = canvasView?.configView
      ? {
          fov: Rect.encode(canvasView.configView),
          view: 'top down',
          type: 'flamechart',
        }
      : undefined;

    return normalizeUrl(
      generateProfileFlamechartRouteWithQuery({
        organization,
        projectSlug,
        profileId,
        query,
      })
    );
  }, [canvasView, organization, profileId, projectSlug]);

  return (
    <Container
      background="primary"
      border="primary"
      containerType="inline-size"
      data-test-id="seer-profile-embed"
      padding="lg"
      radius="md"
      width="100%"
    >
      <Stack gap="lg">
        <Flex align="center" gap="md" justify="between" wrap="wrap">
          <ProfileLink projectSlug={projectSlug} profileId={profileId} />
          <Flex align="center" gap="sm">
            {flamegraph ? (
              <SegmentedControl
                aria-label={t('Profile view')}
                size="xs"
                value={viewMode}
                onChange={setViewMode}
              >
                <SegmentedControl.Item key="aggregated">
                  {t('Left-heavy')}
                </SegmentedControl.Item>
                <SegmentedControl.Item key="timeline">
                  {t('Time-ordered')}
                </SegmentedControl.Item>
              </SegmentedControl>
            ) : null}
            <LinkButton size="xs" to={target}>
              {t('Open in Profiling')}
            </LinkButton>
          </Flex>
        </Flex>

        {isPending ? (
          <Flex align="center" height={PREVIEW_HEIGHT} justify="center">
            <LoadingIndicator />
          </Flex>
        ) : isError || !data ? (
          <Text variant="muted">{t('Unable to load profile details')}</Text>
        ) : (
          <Stack gap="lg">
            {metadata ? (
              <Grid
                columns={{
                  zero: 'repeat(2, minmax(0, 1fr))',
                  sm: 'repeat(3, minmax(0, 1fr))',
                  lg: 'repeat(4, minmax(0, 1fr))',
                }}
                gap="xl"
              >
                {metadata.transactionName ? (
                  <MetadataItem label={t('Transaction')}>
                    {metadata.transactionName}
                  </MetadataItem>
                ) : null}
                {flamegraph && activeProfile ? (
                  <MetadataItem label={t('Duration')}>
                    {flamegraph.formatter(activeProfile.duration)}
                  </MetadataItem>
                ) : null}
                {profileGroup ? (
                  <MetadataItem label={t('Threads')}>
                    {profileGroup.profiles.length}
                  </MetadataItem>
                ) : null}
                {metadata.environment ? (
                  <MetadataItem label={t('Environment')}>
                    {metadata.environment}
                  </MetadataItem>
                ) : null}
                {metadata.release ? (
                  <MetadataItem label={t('Release')}>
                    <Version version={metadata.release} anchor={false} />
                  </MetadataItem>
                ) : null}
                {metadata.os ? (
                  <MetadataItem label={t('OS')}>{metadata.os}</MetadataItem>
                ) : null}
                {metadata.device ? (
                  <MetadataItem label={t('Device')}>{metadata.device}</MetadataItem>
                ) : null}
                {metadata.receivedAt ? (
                  <MetadataItem label={t('Received')}>
                    <DateTime date={metadata.receivedAt} />
                  </MetadataItem>
                ) : null}
              </Grid>
            ) : null}

            {flamegraph ? (
              <ErrorBoundary mini>
                <FlamegraphThemeProvider>
                  <Container
                    data-test-id="seer-profile-flamechart"
                    height={PREVIEW_HEIGHT}
                    position="relative"
                  >
                    <FlamegraphPreview
                      flamegraph={flamegraph}
                      relativeStartTimestamp={0}
                      relativeStopTimestamp={flamegraph.configSpace.width}
                      updateFlamegraphView={setCanvasView}
                    />
                  </Container>
                </FlamegraphThemeProvider>
              </ErrorBoundary>
            ) : null}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
