import {Alert} from '@sentry/scraps/alert';
import {ExternalLink} from '@sentry/scraps/link';

import {releaseHealth} from 'sentry/data/platformCategories';
import {tct} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {Release} from 'sentry/types/release';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';

interface Props {
  organization: Organization;
  releases: Release[];
  selectedProject: Project | undefined;
  selection: PageFilters;
}

export function ReleaseHealthCTA({
  organization,
  releases,
  selectedProject,
  selection,
}: Props) {
  const {
    data: project,
    isPending,
    isError,
  } = useDetailedProject(
    {orgSlug: organization.slug, projectSlug: selectedProject?.slug ?? ''},
    {
      enabled: Boolean(selectedProject) && releases.length > 0,
      staleTime: 1_000, // 1 second
    }
  );

  const trackAddReleaseHealth = () => {
    if (organization.id && selection.projects[0]) {
      trackAnalytics('releases_list.click_add_release_health', {
        organization,
        project_id: selection.projects[0],
      });
    }
  };

  if (isPending || isError) {
    return null;
  }

  const projectCanHaveReleases =
    project.platform && releaseHealth.includes(project.platform);

  if (project.hasSessions || !projectCanHaveReleases) {
    return null;
  }

  return (
    <Alert.Container>
      <Alert variant="info">
        {tct(
          'To track user adoption, crash rates, session data and more, add Release Health to your current setup. [link:Add Release Health]',
          {
            link: (
              <ExternalLink
                href="https://docs.sentry.io/product/releases/setup/#release-health"
                onClick={trackAddReleaseHealth}
              />
            ),
          }
        )}
      </Alert>
    </Alert.Container>
  );
}
