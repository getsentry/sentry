import styled from '@emotion/styled';

import Version from 'sentry/components/version';
import VersionHoverCard from 'sentry/components/versionHoverCard';
import useOrganization from 'sentry/utils/useOrganization';

type ReleasePreviewProps = {
  release: {
    version: string;
  };
};

export function ReleasePreview({release}: ReleasePreviewProps) {
  const organization = useOrganization();

  return (
    <ReleaseWrapper>
      <VersionHoverCard
        organization={organization}
        projectSlug="sentry"
        releaseVersion={release.version}
        showUnderline
        underlineColor="linkUnderline"
      >
        <Version version={String(release.version)} truncate />
      </VersionHoverCard>
    </ReleaseWrapper>
  );
}

const ReleaseWrapper = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;
