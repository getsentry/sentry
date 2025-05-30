import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {releaseHealth} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {AvatarProject, Project} from 'sentry/types/project';
import type {Release} from 'sentry/types/release';
import {trackAnalytics} from 'sentry/utils/analytics';
import Projects from 'sentry/utils/projects';

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
  const trackAddReleaseHealth = useCallback(() => {
    if (organization.id && selection.projects[0]) {
      trackAnalytics('releases_list.click_add_release_health', {
        organization,
        project_id: selection.projects[0],
      });
    }
  }, [organization, selection]);

  if (!selectedProject || selectedProject?.hasSessions !== false || !releases?.length) {
    return null;
  }

  return (
    <Projects orgId={organization.slug} slugs={[selectedProject.slug]}>
      {({projects, initiallyLoaded, fetchError}) => {
        const project: AvatarProject | undefined =
          projects?.length === 1 ? projects.at(0) : undefined;
        const projectCanHaveReleases =
          project?.platform && releaseHealth.includes(project.platform);

        if (!initiallyLoaded || fetchError || !projectCanHaveReleases) {
          return null;
        }

        return (
          <Alert.Container>
            <Alert type="info" showIcon>
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
      }}
    </Projects>
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
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    flex-direction: row;
  }
`;
