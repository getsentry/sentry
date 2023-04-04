import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import NotFound from 'sentry/components/errors/notFound';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {Footer} from 'sentry/components/onboarding/footer';
import {
  performance as performancePlatforms,
  PlatformKey,
} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

// in this case, the default is rendered inside the hook
const SetUpSdkDoc = HookOrDefault({
  hookName: 'component:set-up-sdk-doc',
});

type Props = RouteComponentProps<{platform: string; projectId: string}, {}>;

export function ProjectInstallPlatform({location, params, route, router}: Props) {
  const organization = useOrganization();

  const {projects, initiallyLoaded} = useProjects({
    slugs: [params.projectId],
    orgId: organization.slug,
  });

  const loadingProjects = !initiallyLoaded;
  const project = projects.filter(proj => proj.slug === params.projectId)[0];

  const heartbeatFooter = !!organization?.features.includes(
    'onboarding-heartbeat-footer'
  );

  const platform = platforms.find(p => p.id === params.platform);

  if (!platform) {
    return <NotFound />;
  }

  const issueStreamLink = `/organizations/${organization.slug}/issues/`;
  const performanceOverviewLink = `/organizations/${organization.slug}/performance/`;
  const gettingStartedLink = `/organizations/${organization.slug}/projects/${params.projectId}/getting-started/`;
  const showPerformancePrompt = performancePlatforms.includes(platform.id as PlatformKey);
  const isGettingStarted = window.location.href.indexOf('getting-started') > 0;

  return (
    <Fragment>
      <StyledPageHeader>
        <h2>{t('Configure %(platform)s SDK', {platform: platform.name})}</h2>
        <ButtonBar gap={1}>
          <Button
            icon={<IconChevron direction="left" size="sm" />}
            size="sm"
            to={gettingStartedLink}
          >
            {t('Back')}
          </Button>
          <Button size="sm" href={platform.link ?? undefined} external>
            {t('Full Documentation')}
          </Button>
        </ButtonBar>
      </StyledPageHeader>

      <div>
        <SetUpSdkDoc
          organization={organization}
          project={project}
          location={location}
          router={router}
        />

        {isGettingStarted && showPerformancePrompt && (
          <Feature
            features={['performance-view']}
            hookName="feature-disabled:performance-new-project"
          >
            {({hasFeature}) => {
              if (hasFeature) {
                return null;
              }
              return (
                <StyledAlert type="info" showIcon>
                  {t(
                    `Your selected platform supports performance, but your organization does not have performance enabled.`
                  )}
                </StyledAlert>
              );
            }}
          </Feature>
        )}

        {isGettingStarted && heartbeatFooter ? (
          <Footer
            projectSlug={params.projectId}
            projectId={project?.id}
            route={route}
            router={router}
            location={location}
          />
        ) : (
          <StyledButtonBar gap={1}>
            <Button
              priority="primary"
              busy={loadingProjects}
              to={{
                pathname: issueStreamLink,
                query: project?.id,
                hash: '#welcome',
              }}
            >
              {t('Take me to Issues')}
            </Button>
            <Button
              busy={loadingProjects}
              to={{
                pathname: performanceOverviewLink,
                query: project?.id,
              }}
            >
              {t('Take me to Performance')}
            </Button>
          </StyledButtonBar>
        )}
      </div>
    </Fragment>
  );
}

const StyledButtonBar = styled(ButtonBar)`
  margin-top: ${space(3)};
  width: max-content;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    width: auto;
    grid-row-gap: ${space(1)};
    grid-auto-flow: row;
  }
`;

const StyledPageHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(3)};

  h2 {
    margin: 0;
  }

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: column;
    align-items: flex-start;

    h2 {
      margin-bottom: ${space(2)};
    }
  }
`;

const StyledAlert = styled(Alert)`
  margin-top: ${space(2)};
`;
