import {Box, Flex} from 'grid-emotion';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t, tct} from 'app/locale';
import withApi from 'app/utils/withApi';
import Button from 'app/components/button';
import Link from 'app/components/link';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import NotFound from 'app/components/errors/notFound';
import SentryTypes from 'app/sentryTypes';
import TextBlock from 'app/views/settings/components/text/textBlock';
import withOrganization from 'app/utils/withOrganization';

const ProjectInstallPlatform = createReactClass({
  displayName: 'ProjectInstallPlatform',

  propTypes: {
    api: PropTypes.object,
    organization: SentryTypes.Organization.isRequired,
    project: SentryTypes.Project.isRequired,

    // eslint-disable-next-line react/no-unused-prop-types
    platformData: PropTypes.object.isRequired,

    linkPath: PropTypes.func,
  },

  getDefaultProps() {
    return {
      linkPath: (orgId, projectId, platform) =>
        `/${orgId}/${projectId}/settings/install/${platform}/`,
    };
  },

  getInitialState(props) {
    props = props || this.props;
    const params = props.params;
    const key = params.platform;
    let integration;
    let platform;

    props.platformData.platforms.forEach(p_item => {
      if (integration) {
        return;
      }
      integration = p_item.integrations.filter(i_item => {
        return i_item.id == key;
      })[0];
      if (integration) {
        platform = p_item;
      }
    });

    return {
      loading: true,
      error: false,
      integration,
      platform,
      html: null,
    };
  },

  componentDidMount() {
    this.fetchData();
    window.scrollTo(0, 0);

    const {platform} = this.props.params;

    //redirect if platform is not known.
    if (!platform || platform === 'other') {
      this.redirectToNeutralDocs();
    }
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.params.platform !== this.props.params.platform) {
      this.setState(this.getInitialState(nextProps), this.fetchData);
      window.scrollTo(0, 0);
    }
  },

  isGettingStarted() {
    return location.href.indexOf('getting-started') > 0;
  },

  fetchData() {
    const {orgId, projectId, platform} = this.props.params;
    this.props.api.request(`/projects/${orgId}/${projectId}/docs/${platform}/`, {
      success: data => {
        this.setState({
          loading: false,
          error: false,
          html: data.html,
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
      },
    });
  },

  getPlatformLink(platform, display) {
    const {orgId, projectId} = this.props.params;
    const path = this.props.linkPath(orgId, projectId, platform);
    return (
      <Link key={platform} to={path} className="list-group-item">
        {display || platform}
      </Link>
    );
  },

  redirectToNeutralDocs() {
    const {orgId, projectId} = this.props.params;
    const {organization} = this.props;

    const url = new Set(organization.features).has('sentry10')
      ? `/organizations/${orgId}/projects/${projectId}/getting-started/`
      : `/${orgId}/${projectId}/getting-started/`;

    browserHistory.push(url);
  },

  render() {
    const {integration, platform} = this.state;
    const {
      organization,
      project,
      params: {orgId, projectId},
    } = this.props;

    if (!integration || !platform) {
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
          {t('Configure %(integration)s', {integration: integration.name})}
          <Flex>
            <Box ml={1}>
              <Button size="small" href={gettingStartedLink}>
                {t('< Back')}
              </Button>
            </Box>
            <Box ml={1}>
              <Button size="small" href={integration.link} external>
                {t('Full Documentation')}
              </Button>
            </Box>
          </Flex>
        </PanelHeader>

        <PanelBody disablePadding={false}>
          <TextBlock>
            {tct(
              `
             This is a quick getting started guide. For in-depth instructions
             on integrating Sentry with [integration], view
             [docLink:our complete documentation].
            `,
              {
                integration: integration.name,
                docLink: <a href={integration.link} />,
              }
            )}
          </TextBlock>

          {this.state.loading ? (
            <LoadingIndicator />
          ) : this.state.error ? (
            <LoadingError onRetry={this.fetchData} />
          ) : (
            <DocumentationWrapper dangerouslySetInnerHTML={{__html: this.state.html}} />
          )}

          {this.isGettingStarted() && (
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
  },
});

export {ProjectInstallPlatform};
export default withApi(withOrganization(ProjectInstallPlatform));

const DocumentationWrapper = styled('div')`
  p {
    line-height: 1.5;
  }
  pre {
    word-break: break-all;
    white-space: pre-wrap;
  }
`;
