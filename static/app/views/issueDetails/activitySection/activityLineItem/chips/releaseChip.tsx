import {Version} from 'sentry/components/version';
import {VersionHoverCard} from 'sentry/components/versionHoverCard';
import {IconReleases} from 'sentry/icons';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

import {InlineChip} from './inlineChip';

export function ActivityRelease({
  organization,
  project,
  version,
}: {
  organization: Organization;
  project: Project;
  version: string;
}) {
  return (
    <VersionHoverCard
      organization={organization}
      projectSlug={project.slug}
      releaseVersion={version}
      containerDisplayMode="inline-block"
    >
      <InlineChip variant="constrained">
        <IconReleases size="xs" />
        <Version version={version} projectId={project.id} truncate />
      </InlineChip>
    </VersionHoverCard>
  );
}
