import PropTypes from 'prop-types';
import React from 'react';
import SentryTypes from 'app/sentryTypes';
import Button from 'app/components/button';
import styled from 'react-emotion';


import withApi from 'app/utils/withApi';
import withLatestContext from 'app/utils/withLatestContext';

class OpenInButton extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    lineNo: PropTypes.number,
    filename: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      error: false,
      components: [],
      sentryApps: [],
      installs: [],
    };
  }

  componentWillMount() {
    this.fetchIssueLinkComponents();
  }

  fetchIssueLinkComponents() {
    const {api, organization, project} = this.props;
    api
      .requestPromise(
        `/organizations/${organization.slug}/sentry-app-components/?filter=stracktrace-link&projectId=${project.id}`
      )
      .then(data => {
        if (data.length) {
          this.fetchInstallations();
          this.setState({components: data});
        }
      })
      .catch(error => {
        return;
      });
  }

  fetchInstallations() {
    const {api, organization} = this.props;
    api
      .requestPromise(`/organizations/${organization.slug}/sentry-app-installations/`)
      .then(data => {
        if (data.length) {
          this.fetchSentryApps();
          this.setState({installs: data});
        }
      })
      .catch(error => {
        return;
      });
  }

  fetchSentryApps() {
    const {api, organization} = this.props;
    api
      .requestPromise(`/organizations/${organization.slug}/sentry-apps/`)
      .then(data => {
        this.setState({sentryApps: data});
      })
      .catch(error => {
        return;
      });
  }

  getInstallforComponent(component) {
    const appId = component.sentryApp.uuid;
    return this.state.installs.filter(install => install.app.uuid == appId)[0];
  }

  getAppforComponent(component) {
    const appId = component.sentryApp.uuid;
    return this.state.sentryApps.filter(app => app.uuid == appId)[0];
  }

  getLinkUrl() {
    //won't need to filter once other PR is in
    const components = (this.state.components || []).filter(
      c => c.type == 'stacktrace-link'
    );
    const {filename, lineNo, project} = this.props;

    if (components.length) {
      const uri = components[0].schema.uri;
      const install = this.getInstallforComponent(components[0]);
      const sentryApp = this.getAppforComponent(components[0]);
      const baseUrl = sentryApp.webhookUrl;
      const file = encodeURIComponent(filename);
      return `${baseUrl}${uri}?filename=${file}&lineNo=${lineNo}&project=${project.slug}&installationId=${install.uuid}`;
    }
    return '';
  }

  getName() {
    const {components} = this.state;
    if (components.length) {
      return components[0].sentryApp.name;
    }
    return '';
  }

  render() {
    const {components, installs, sentryApps} = this.state;
    if (!components.length || !installs.length || !sentryApps.length) {
      return null;
    }

    const url = this.getLinkUrl();
    const name = this.getName();
    return (
      <StyledButtonContainer>
        <StyledButton href={url} size="small" priority="primary">
          {`Debug In ${name}`}
        </StyledButton>
      </StyledButtonContainer>
    );
  }
}

const OpenInButtonComponent = withLatestContext(OpenInButton);
export default withApi(OpenInButtonComponent);

const StyledButtonContainer = styled('div')`
  height: 0;
  position: relative;
`;

const StyledButton = styled(Button)`
  position: absolute;
  z-index: 1000;
  height: 36px;
  line-height: 1.5;
  padding: 0px 5px;
  top: -31px;
  right: 30px;
`;
