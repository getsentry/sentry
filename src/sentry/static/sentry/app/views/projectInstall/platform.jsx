import {Box, Flex} from 'grid-emotion';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Panel, PanelAlert, PanelBody, PanelHeader} from 'app/components/panels';
import {loadDocs} from 'app/actionCreators/projects';
import {t, tct} from 'app/locale';
import Button from 'app/components/button';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import NotFound from 'app/components/errors/notFound';
import SentryTypes from 'app/sentryTypes';
import platforms from 'app/data/platforms';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import withProject from 'app/utils/withProject';

class ProjectInstallPlatform extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    organization: SentryTypes.Organization.isRequired,
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

  async fetchData() {
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
  }

  redirectToNeutralDocs() {
    const {orgId, projectId} = this.props.params;
    const {organization} = this.props;

    const url = new Set(organization.features).has('sentry10')
      ? `/organizations/${orgId}/projects/${projectId}/getting-started/`
      : `/${orgId}/${projectId}/getting-started/`;

    browserHistory.push(url);
  }

  render() {
    const {organization, project, params} = this.props;
    const {orgId, projectId} = params;

    const platform = platforms.find(p => p.id === params.platform);

    if (!platform) {
      return <NotFound />;
    }

    const hasSentry10 = new Set(organization.features).has('sentry10');

    const issueStreamLink = hasSentry10
      ? `/organizations/${orgId}/issues/?project=${project.id}#welcome`
      : `/${orgId}/${projectId}/#welcome`;

    const gettingStartedLink = hasSentry10
      ? `/organizations/${orgId}/projects/${projectId}/getting-started/`
      : `/${orgId}/${projectId}/getting-started/`;

    return (
      <Panel>
        <PanelHeader hasButtons>
          {t('Configure %(platform)s', {platform: platform.name})}
          <Flex>
            <Box ml={1}>
              <Button size="small" href={gettingStartedLink}>
                {t('< Back')}
              </Button>
            </Box>
            <Box ml={1}>
              <Button size="small" href={platform.link} external>
                {t('Full Documentation')}
              </Button>
            </Box>
          </Flex>
        </PanelHeader>

        <PanelAlert type="info">
          {tct(
            `
             This is a quick getting started guide. For in-depth instructions
             on integrating Sentry with [platform], view
             [docLink:our complete documentation].
            `,
            {
              platform: platform.name,
              docLink: <a href={platform.link} />,
            }
          )}
        </PanelAlert>

        <PanelBody disablePadding={false}>
          {this.state.loading ? (
            <LoadingIndicator />
          ) : this.state.error ? (
            <LoadingError onRetry={this.fetchData} />
          ) : (
            <DocumentationWrapper dangerouslySetInnerHTML={{__html: this.state.html}} />
          )}

          {this.isGettingStarted && (
            <Button
              priority="primary"
              size="large"
              to={issueStreamLink}
              style={{marginTop: 20}}
            >
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

export {ProjectInstallPlatform};
export default withApi(withOrganization(withProject(ProjectInstallPlatform)));
