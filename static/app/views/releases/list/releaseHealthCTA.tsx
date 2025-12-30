import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {ExternalLink} from 'sentry/components/core/link';
import {releaseHealth} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {Release} from 'sentry/types/release';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApiQuery} from 'sentry/utils/queryClient';

interface Props {
  organization: Organization;
  releases: Release[];
  selectedProject: Project | undefined;
  selection: PageFilters;
}

export default function ReleaseHealthCTA({
  organization,
  releases,
  selectedProject,
  selection,
}: Props) {
  const {
    data: project,
    isPending,
    isError,
  } = useApiQuery<Project>([`/projects/${organization.slug}/${selectedProject?.slug}/`], {
    enabled: Boolean(selectedProject) && releases.length > 0,
    staleTime: 1_000, // 1 second
  });

  const trackAddReleaseHealth = useCallback(() => {
    if (organization.id && selection.projects[0]) {
      trackAnalytics('releases_list.click_add_release_health', {
        organization,
        project_id: selection.projects[0],
      });
    }
  }, [organization, selection]);

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
        <AlertText>
          <div>
            {t(
              'To track user adoption, crash rates, session data and more, add Release Health to your current setup.'
            )}
          </div>
          <ExternalLink
            href="https://docs.sentry.io/product/releases/setup/#release-health"
            onClick={trackAddReleaseHealth}
          >
            {t('Add Release Health')}
          </ExternalLink>
        </AlertText>
      </Alert>
    </Alert.Container>
  );
}

const AlertText = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  gap: ${space(2)};

  > *:nth-child(1) {
    flex: 1;
  }
  flex-direction: column;
  @media (min-width: ${p => p.theme.breakpoints.md}) {
    flex-direction: row;
  }
`;
