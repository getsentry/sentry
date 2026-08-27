import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {FlamegraphPreview} from 'sentry/components/profiling/flamegraph/flamegraphPreview';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {IconProfiling} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getShortEventId} from 'sentry/utils/events';
import {Flamegraph as FlamegraphModel} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  ProfileGroupProvider,
  useProfileGroup,
} from 'sentry/views/explore/profiling/profileGroupProvider';
import {
  ProfilesProvider,
  useProfiles,
} from 'sentry/views/explore/profiling/profilesProvider';

import {EvidenceBoundary, EvidenceFrame, LazyEvidence} from './evidenceFrame';

type ProfileLinkOutput = Extract<EmbedOutput<'profile'>, {profileId: string}>;

function ProfileLink({projectSlug, profileId}: ProfileLinkOutput) {
  const organization = useOrganization();
  const href = normalizeUrl(
    generateProfileFlamechartRoute({organization, projectSlug, profileId})
  );

  return (
    <ResourceLink
      icon={IconProfiling}
      href={href}
      title={t('Profile %s', getShortEventId(profileId))}
    />
  );
}

function ProfilePreviewContent() {
  const profiles = useProfiles();
  const profileGroup = useProfileGroup();
  const activeProfile =
    profileGroup.profiles[profileGroup.activeProfileIndex] ??
    profileGroup.profiles[0] ??
    null;
  const flamegraph = useMemo(
    () =>
      activeProfile ? new FlamegraphModel(activeProfile, {sort: 'left heavy'}) : null,
    [activeProfile]
  );

  if (profiles.type === 'loading' || profiles.type === 'initial') {
    return <Placeholder height="180px" />;
  }
  if (profiles.type === 'errored') {
    return <Text variant="muted">{t('This profile could not be loaded.')}</Text>;
  }
  if (!flamegraph) {
    return <Text variant="muted">{t('This profile has no retained samples.')}</Text>;
  }

  return (
    <PreviewContainer>
      <FlamegraphPreview
        flamegraph={flamegraph}
        relativeStartTimestamp={0}
        relativeStopTimestamp={flamegraph.configSpace.width}
      />
    </PreviewContainer>
  );
}

function ProfileGroup({profileId}: {profileId: string}) {
  const profiles = useProfiles();
  return (
    <ProfileGroupProvider
      type="flamegraph"
      input={profiles.type === 'resolved' ? profiles.data : null}
      traceID={profileId}
    >
      <FlamegraphThemeProvider>
        <ProfilePreviewContent />
      </FlamegraphThemeProvider>
    </ProfileGroupProvider>
  );
}

function ProfileEvidenceContent({
  profileId,
  projectSlug,
}: {
  profileId: string;
  projectSlug?: string;
}) {
  const organization = useOrganization();
  const fallbackHref = `/organizations/${organization.slug}/explore/profiles/?query=${encodeURIComponent(`profile.id:${profileId}`)}`;

  if (!projectSlug) {
    return (
      <EvidenceFrame
        title={t('Profile %s', profileId)}
        detail={t('Project context was not included, so a preview is unavailable.')}
        icon={IconProfiling}
        href={fallbackHref}
      />
    );
  }

  const href = generateProfileFlamechartRoute({
    organization,
    projectSlug,
    profileId,
  });

  return (
    <EvidenceFrame
      title={t('Profile %s', profileId)}
      detail={projectSlug}
      icon={IconProfiling}
      href={href}
    >
      <ProfilesProvider
        orgSlug={organization.slug}
        projectSlug={projectSlug}
        profileMeta={profileId}
      >
        <ProfileGroup profileId={profileId} />
      </ProfilesProvider>
    </EvidenceFrame>
  );
}

export const Profile = defineSeerEmbed({
  name: 'profile',
  render(props) {
    if ('profileId' in props) {
      return <ProfileLink {...props} />;
    }
    return (
      <EvidenceBoundary>
        <LazyEvidence>
          <ProfileEvidenceContent
            profileId={props.profile_id}
            projectSlug={props.project_slug}
          />
        </LazyEvidence>
      </EvidenceBoundary>
    );
  },
});

const PreviewContainer = styled('div')`
  height: 180px;
  overflow: hidden;
`;
