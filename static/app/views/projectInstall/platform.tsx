import 'prism-sentry/index.css';

import {Component, Fragment} from 'react';
import {browserHistory, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import {loadDocs} from 'app/actionCreators/projects';
import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import NotFound from 'app/components/errors/notFound';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {
  performance as performancePlatforms,
  PlatformKey,
} from 'app/data/platformCategories';
import platforms from 'app/data/platforms';
import {IconInfo} from 'app/icons';
import {t, tct} from 'app/locale';
import {PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import Projects from 'app/utils/projects';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  api: Client;
  organization: Organization;
} & WithRouterProps<{orgId: string; projectId: string; platform: string}, {}>;

type State = {
  loading: boolean;
  error: boolean;
  html: string;
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
    const {api, params} = this.props;
    const {orgId, projectId, platform} = params;

    this.setState({loading: true});

    try {
      const {html} = await loadDocs(api, orgId, projectId, platform as PlatformKey);
      this.setState({html});
    } catch (error) {
      this.setState({error});
    }

    this.setState({loading: false});
  };

  redirectToNeutralDocs() {
    const {orgId, projectId} = this.props.params;

    const url = `/organizations/${orgId}/projects/${projectId}/getting-started/`;

    browserHistory.push(url);
  }

  render() {
    const {params} = this.props;
    const {orgId, projectId} = params;

    const platform = platforms.find(p => p.id === params.platform);

    if (!platform) {
      return <NotFound />;
    }

    const issueStreamLink = `/organizations/${orgId}/issues/`;
    const performanceOverviewLink = `/organizations/${orgId}/performance/`;
    const gettingStartedLink = `/organizations/${orgId}/projects/${projectId}/getting-started/`;
    const platformLink = platform.link ?? undefined;

    return (
      <Fragment>
        <StyledPageHeader>
          <h2>{t('Configure %(platform)s', {platform: platform.name})}</h2>
          <ButtonBar gap={1}>
            <Button size="small" to={gettingStartedLink}>
              {t('< Back')}
            </Button>
            <Button size="small" href={platformLink} external>
              {t('Full Documentation')}
            </Button>
          </ButtonBar>
        </StyledPageHeader>

        <div>
          <Alert type="info" icon={<IconInfo />}>
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

          {this.isGettingStarted && (
            <Projects
              key={`${orgId}-${projectId}`}
              orgId={orgId}
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
                const showPerformancePrompt = performancePlatforms.includes(
                  platform.id as PlatformKey
                );

                return (
                  <Fragment>
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
                  </Fragment>
                );
              }}
            </Projects>
          )}
        </div>
      </Fragment>
    );
  }
}

const DocumentationWrapper = styled('div')`
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

  p {
    line-height: 1.5;
  }
  pre {
    word-break: break-all;
    white-space: pre-wrap;
  }
`;

const StyledButtonBar = styled(ButtonBar)`
  margin-top: ${space(3)};
  width: max-content;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    width: auto;
    grid-row-gap: ${space(1)};
    grid-auto-flow: row;
  }
`;

const StyledPageHeader = styled(PageHeader)`
  margin-bottom: ${space(3)};

  h2 {
    margin: 0;
  }

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
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
