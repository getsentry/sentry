import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import 'prismjs/themes/prism-tomorrow.css';

import {Panel, PanelAlert, PanelBody, PanelHeader} from 'app/components/panels';
import {performance as performancePlatforms} from 'app/data/platformCategories';
import {loadDocs} from 'app/actionCreators/projects';
import {t, tct} from 'app/locale';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Feature from 'app/components/acl/feature';
import {IconInfo} from 'app/icons';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import NotFound from 'app/components/errors/notFound';
import Projects from 'app/utils/projects';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import platforms from 'app/data/platforms';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

class ProjectInstallPlatform extends React.Component {
  static propTypes = {
    api: PropTypes.object,
  };

  state = {
    loading: true,
    error: false,
    html: null,
  };

  componentDidMount() {
    this.fetchData();
    window.scrollTo(0, 0);

    const {platform} = this.props.params;

    //redirect if platform is not known.
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
      const {html} = await loadDocs(api, orgId, projectId, platform);
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

    return (
      <Panel>
        <PanelHeader hasButtons>
          {t('Configure %(platform)s', {platform: platform.name})}
          <Actions>
            <Button size="small" to={gettingStartedLink}>
              {t('< Back')}
            </Button>
            <Button size="small" href={platform.link} external>
              {t('Full Documentation')}
            </Button>
          </Actions>
        </PanelHeader>

        <PanelAlert type="info">
          {tct(
            `
             This is a quick getting started guide. For in-depth instructions
             on integrating Sentry with [platform], view
             [docLink:our complete documentation].`,
            {
              platform: platform.name,
              docLink: <a href={platform.link} />,
            }
          )}
        </PanelAlert>

        <PanelBody withPadding>
          {this.state.loading ? (
            <LoadingIndicator />
          ) : this.state.error ? (
            <LoadingError onRetry={this.fetchData} />
          ) : (
            <React.Fragment>
              <SentryDocumentTitle
                title={`${t('Configure')} ${platform.name}`}
                objSlug={projectId}
              />
              <DocumentationWrapper dangerouslySetInnerHTML={{__html: this.state.html}} />
            </React.Fragment>
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
                        project: projects[0].id,
                      }
                    : {};
                const showPerformancePrompt = performancePlatforms.includes(platform.id);

                return (
                  <React.Fragment>
                    {showPerformancePrompt && (
                      <Feature
                        features={['organization:performance-view']}
                        hookName="feature-disabled:performance-new-project"
                      >
                        {({hasFeature}) => {
                          if (hasFeature) {
                            return null;
                          }
                          return (
                            <Alert type="info" icon={<IconInfo />}>
                              {t(
                                `Your selected platform supports performance, but your organization does not have performance enabled.`
                              )}
                            </Alert>
                          );
                        }}
                      </Feature>
                    )}

                    <ButtonContainer>
                      <ButtonBar gap={1}>
                        <Button
                          key="issues"
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
                          key="performance"
                          busy={projectsLoading}
                          to={{
                            pathname: performanceOverviewLink,
                            query: projectFilter,
                          }}
                        >
                          {t('Take me to Performance')}
                        </Button>
                      </ButtonBar>
                    </ButtonContainer>
                  </React.Fragment>
                );
              }}
            </Projects>
          )}
        </PanelBody>
      </Panel>
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

const Actions = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
`;

const ButtonContainer = styled('div')`
  display: flex;
  margin-top: ${space(3)};
`;

export {ProjectInstallPlatform};
export default withApi(withOrganization(ProjectInstallPlatform));
