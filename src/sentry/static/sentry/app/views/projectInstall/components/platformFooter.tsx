import React from 'react';
import styled from '@emotion/styled';

import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {
  performance as performancePlatforms,
  PlatformKey,
} from 'app/data/platformCategories';
import {IconInfo} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {PlatformIntegration, Project} from 'app/types';
import Projects from 'app/utils/projects';

type Props = {
  orgSlug: string;
  projectSlug: string;
  platform: PlatformIntegration;
};
export default function PlatformFooter({orgSlug, projectSlug, platform}: Props) {
  const issueStreamLink = `/organizations/${orgSlug}/issues/`;
  const performanceOverviewLink = `/organizations/${orgSlug}/performance/`;
  return (
    <Projects
      key={`${orgSlug}-${projectSlug}`}
      orgId={orgSlug}
      slugs={[projectSlug]}
      passthroughPlaceholderProject={false}
    >
      {({projects, initiallyLoaded, fetching, fetchError}) => {
        const projectsLoading = !initiallyLoaded && fetching;
        const projectFilter =
          !projectsLoading && !fetchError && projects.length
            ? {
                project: (projects[0] as Project).id,
              }
            : {};
        const showPerformancePrompt = performancePlatforms.includes(
          platform.id as PlatformKey
        );

        return (
          <React.Fragment>
            {showPerformancePrompt && (
              <Feature
                features={['performance-view']}
                hookName="feature-disabled:performance-new-project"
              >
                {({hasFeature}) => {
                  if (hasFeature) {
                    return null;
                  }
                  return (
                    <StyledAlert type="info" icon={<IconInfo />}>
                      {t(
                        `Your selected platform supports performance, but your organization does not have performance enabled.`
                      )}
                    </StyledAlert>
                  );
                }}
              </Feature>
            )}

            <StyledButtonBar gap={1}>
              <Button
                priority="primary"
                busy={projectsLoading}
                to={{
                  pathname: issueStreamLink,
                  query: projectFilter,
                  hash: '#welcome',
                }}
              >
                {t('Take me to Issues')}
              </Button>
              <Button
                busy={projectsLoading}
                to={{
                  pathname: performanceOverviewLink,
                  query: projectFilter,
                }}
              >
                {t('Take me to Performance')}
              </Button>
            </StyledButtonBar>
          </React.Fragment>
        );
      }}
    </Projects>
  );
}

const StyledButtonBar = styled(ButtonBar)`
  margin-top: ${space(3)};
  width: max-content;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    width: auto;
    grid-row-gap: ${space(1)};
    grid-auto-flow: row;
  }
`;

const StyledAlert = styled(Alert)`
  margin-top: ${space(2)};
`;
