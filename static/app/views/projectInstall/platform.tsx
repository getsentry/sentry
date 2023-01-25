import 'prism-sentry/index.css';

import {Component, Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {loadDocs} from 'sentry/actionCreators/projects';
import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import NotFound from 'sentry/components/errors/notFound';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {
  performance as performancePlatforms,
  PlatformKey,
} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import Projects from 'sentry/utils/projects';
import withApi from 'sentry/utils/withApi';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withOrganization from 'sentry/utils/withOrganization';
import {HeartbeatFooter} from 'sentry/views/projectInstall/heartbeatFooter';

type Props = {
  api: Client;
  organization: Organization;
} & RouteComponentProps<{platform: string; projectId: string}, {}>;

type State = {
  error: boolean;
  html: string;
  loading: boolean;
};

class ProjectInstallPlatform extends Component<Props, State> {
  state: State = {
    loading: true,
    error: false,
    html: '',
  };

  componentDidMount() {
    this.fetchData();
    window.scrollTo(0, 0);

    const {platform} = this.props.params;

    // redirect if platform is not known.
    if (!platform || platform === 'other') {
      this.redirectToNeutralDocs();
    }
  }

  get isGettingStarted() {
    return window.location.href.indexOf('getting-started') > 0;
  }

  fetchData = async () => {
    const {api, organization, params} = this.props;
    const {projectId, platform} = params;

    this.setState({loading: true});

    try {
      const {html} = await loadDocs(
        api,
        organization.slug,
        projectId,
        platform as PlatformKey
      );
      this.setState({html});
    } catch (error) {
      this.setState({error});
    }

    this.setState({loading: false});
  };

  redirectToNeutralDocs() {
    const {organization} = this.props;
    const {projectId} = this.props.params;

    const url = `/organizations/${organization.slug}/projects/${projectId}/getting-started/`;

    browserHistory.push(normalizeUrl(url));
  }

  render() {
    const {params, organization} = this.props;
    const {projectId} = params;

    const platform = platforms.find(p => p.id === params.platform);

    if (!platform) {
      return <NotFound />;
    }

    const issueStreamLink = `/organizations/${organization.slug}/issues/`;
    const performanceOverviewLink = `/organizations/${organization.slug}/performance/`;
    const gettingStartedLink = `/organizations/${organization.slug}/projects/${projectId}/getting-started/`;
    const platformLink = platform.link ?? undefined;
    const showPerformancePrompt = performancePlatforms.includes(
      platform.id as PlatformKey
    );

    return (
      <Fragment>
        <StyledPageHeader>
          <h2>{t('Configure %(platform)s', {platform: platform.name})}</h2>
          <ButtonBar gap={1}>
            <Button
              icon={<IconChevron direction="left" size="sm" />}
              size="sm"
              to={gettingStartedLink}
            >
              {t('Back')}
            </Button>
            <Button size="sm" href={platformLink} external>
              {t('Full Documentation')}
            </Button>
          </ButtonBar>
        </StyledPageHeader>

        <div>
          <Alert type="info" showIcon>
            {tct(
              `
             This is a quick getting started guide. For in-depth instructions
             on integrating Sentry with [platform], view
             [docLink:our complete documentation].`,
              {
                platform: platform.name,
                docLink: <a href={platformLink} />,
              }
            )}
          </Alert>

          {this.state.loading ? (
            <LoadingIndicator />
          ) : this.state.error ? (
            <LoadingError onRetry={this.fetchData} />
          ) : (
            <Fragment>
              <SentryDocumentTitle
                title={`${t('Configure')} ${platform.name}`}
                projectSlug={projectId}
              />
              <DocumentationWrapper dangerouslySetInnerHTML={{__html: this.state.html}} />
            </Fragment>
          )}

          {this.isGettingStarted && showPerformancePrompt && (
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

          {this.isGettingStarted &&
            !organization.features?.includes('onboarding-heartbeat-footer') && (
              <Projects
                key={`${organization.slug}-${projectId}`}
                orgId={organization.slug}
                slugs={[projectId]}
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

                  return (
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
                  );
                }}
              </Projects>
            )}
        </div>
        {this.isGettingStarted &&
          organization.features?.includes('onboarding-heartbeat-footer') && (
            <HeartbeatFooter
              projectSlug={projectId}
              issueStreamLink={issueStreamLink}
              performanceOverviewLink={performanceOverviewLink}
              route={this.props.route}
              router={this.props.router}
            />
          )}
      </Fragment>
    );
  }
}

const DocumentationWrapper = styled('div')`
  line-height: 1.5;

  .gatsby-highlight {
    margin-bottom: ${space(3)};

    &:last-child {
      margin-bottom: 0;
    }
  }

  .alert {
    margin-bottom: ${space(3)};
    border-radius: ${p => p.theme.borderRadius};
  }

  pre {
    word-break: break-all;
    white-space: pre-wrap;
  }

  blockquote {
    padding: ${space(1)};
    margin-left: 0;
    background: ${p => p.theme.alert.info.backgroundLight};
    border-left: 2px solid ${p => p.theme.alert.info.border};
  }
  blockquote > *:last-child {
    margin-bottom: 0;
  }
`;

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

export {ProjectInstallPlatform};
export default withApi(withOrganization(ProjectInstallPlatform));
