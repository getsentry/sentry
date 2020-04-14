import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {Panel, PanelAlert, PanelBody, PanelHeader} from 'app/components/panels';
import {loadDocs} from 'app/actionCreators/projects';
import {t, tct} from 'app/locale';
import Button from 'app/components/button';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import NotFound from 'app/components/errors/notFound';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import SentryTypes from 'app/sentryTypes';
import platforms from 'app/data/platforms';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import withProject from 'app/utils/withProject';

class ProjectInstallPlatform extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    project: SentryTypes.Project.isRequired,
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
    const {project, params} = this.props;
    const {orgId, projectId} = params;

    const platform = platforms.find(p => p.id === params.platform);

    if (!platform) {
      return <NotFound />;
    }

    const issueStreamLink = `/organizations/${orgId}/issues/?project=${project.id}#welcome`;
    const gettingStartedLink = `/organizations/${orgId}/projects/${projectId}/getting-started/`;

    return (
      <Panel>
        <PanelHeader hasButtons>
          {t('Configure %(platform)s', {platform: platform.name})}
          <Actions>
            <Button size="small" href={gettingStartedLink}>
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
            <Button priority="primary" to={issueStreamLink} style={{marginTop: 20}}>
              {t('Got it! Take me to the Issue Stream.')}
            </Button>
          )}
        </PanelBody>
      </Panel>
    );
  }
}

const DocumentationWrapper = styled('div')`
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

export {ProjectInstallPlatform};
export default withApi(withOrganization(withProject(ProjectInstallPlatform)));
