import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t, tct} from 'app/locale';
import analytics from 'app/utils/analytics';
import ApiMixin from 'app/mixins/apiMixin';
import Button from 'app/components/buttons/button';
import ConfigStore from 'app/stores/configStore';
import InstallReactTest from 'app/views/planout/installReact';
import LanguageNav from 'app/views/projectInstall/languageNav';
import Link from 'app/components/link';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import NotFound from 'app/components/errors/notFound';
import TextBlock from 'app/views/settings/components/text/textBlock';

const ProjectInstallPlatform = createReactClass({
  displayName: 'ProjectInstallPlatform',

  propTypes: {
    platformData: PropTypes.object.isRequired,
    linkPath: PropTypes.func,
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      linkPath: (orgId, projectId, platform) =>
        `/${orgId}/${projectId}/settings/install/${platform}/`,
    };
  },

  getInitialState(props) {
    props = props || this.props;
    let params = props.params;
    let key = params.platform;
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
      experimentPlatforms: new Set(['javascript-react']),
    };
  },

  componentDidMount() {
    this.fetchData();
    $(window).scrollTop(0);
    this.recordAnalytics();
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.params.platform !== this.props.params.platform) {
      this.setState(this.getInitialState(nextProps), this.fetchData);
      $(window).scrollTop(0);
    }
  },

  isGettingStarted() {
    return location.href.indexOf('getting-started') > 0;
  },

  fetchData() {
    let {orgId, projectId, platform} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/docs/${platform}/`, {
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
    let {orgId, projectId} = this.props.params;
    let path = this.props.linkPath(orgId, projectId, platform);
    return (
      <Link key={platform} to={path} className="list-group-item">
        {display || platform}
      </Link>
    );
  },

  inInstallExperiment() {
    let {experimentPlatforms} = this.state;
    let currentPlatform = this.state.integration.id;
    let installExperiment =
      ConfigStore.get('features').has('install-experiment') &&
      experimentPlatforms.has(currentPlatform);
    return installExperiment;
  },

  recordAnalytics() {
    let {experimentPlatforms, integration} = this.state;
    let currentPlatform = integration.id;

    if (!experimentPlatforms.has(currentPlatform)) return;
    analytics('experiment.installation_instructions', {
      integration: integration.id,
      variant: this.inInstallExperiment(),
    });
  },

  renderSidebar() {
    let platform = this.state.platform;
    return (
      <div className="install-sidebar col-md-2">
        {this.props.platformData.platforms.map(p_item => {
          return (
            <LanguageNav
              key={p_item.id}
              name={p_item.name}
              active={platform && platform.id === p_item.id}
            >
              {p_item.integrations.map(i_item => {
                return this.getPlatformLink(
                  i_item.id,
                  i_item.id === p_item.id ? t('Generic') : i_item.name
                );
              })}
            </LanguageNav>
          );
        })}
      </div>
    );
  },

  renderBody() {
    let {integration, platform} = this.state;
    let {orgId, projectId} = this.props.params;

    if (!integration || !platform) {
      return <NotFound />;
    }

    return (
      <Panel>
        <PanelHeader hasButtons>
          {t('Configure %(integration)s', {integration: integration.name})}
          <Button size="small" href={integration.link} external>
            {t('Full Documentation')}
          </Button>
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
              to={`/${orgId}/${projectId}/#welcome`}
              style={{marginTop: 20}}
            >
              {t('Got it! Take me to the Issue Stream.')}
            </Button>
          )}
        </PanelBody>
      </Panel>
    );
  },

  renderTestBody() {
    let {integration, platform} = this.state;
    let {dsnPublic} = this.props.platformData;
    let {orgId, projectId} = this.props.params;

    if (!integration || !platform) {
      return <NotFound />;
    }

    return (
      <Panel>
        <PanelHeader hasButtons>
          {t('Configure %(integration)s', {integration: integration.name})}
          <Button size="small" href={integration.link} external>
            {t('Full Documentation')}
          </Button>
        </PanelHeader>

        <PanelBody disablePadding={false}>
          {this.state.loading ? (
            <LoadingIndicator />
          ) : this.state.error ? (
            <LoadingError onRetry={this.fetchData} />
          ) : (
            <InstallReactTest dsn={dsnPublic} />
          )}
          {this.isGettingStarted() && (
            <Button
              priority="primary"
              size="large"
              to={`/${orgId}/${projectId}/#welcome`}
              style={{marginTop: 20}}
            >
              {t('Got it! Take me to the Issue Stream.')}
            </Button>
          )}
        </PanelBody>
      </Panel>
    );
  },

  render() {
    let installExperiment;
    if (!this.state.loading) {
      installExperiment = this.inInstallExperiment();
    }

    return (
      <div className="install row">
        <div className="install-content col-md-10">
          {installExperiment ? this.renderTestBody() : this.renderBody()}
        </div>
        {this.renderSidebar()}
      </div>
    );
  },
});

export default ProjectInstallPlatform;

const DocumentationWrapper = styled('div')`
  p {
    line-height: 1.5;
  }
  pre {
    word-break: break-all;
    white-space: pre-wrap;
  }
`;
