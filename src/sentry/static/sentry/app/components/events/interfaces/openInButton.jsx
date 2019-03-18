import PropTypes from 'prop-types';
import React from 'react';
import SentryTypes from 'app/sentryTypes';
import Button from 'app/components/button';
import parseurl from 'parseurl';
import qs from 'query-string';
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
        `/organizations/${organization.slug}/sentry-app-components/?filter=stacktrace-link&projectId=${project.id}`
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

  getInstallApp(component) {
    const appId = component.sentryApp.uuid;
    const sentryApp = this.state.sentryApps.filter(a => a.uuid == appId)[0];
    const install = this.state.installs.filter(i => i.app.uuid == appId)[0];
    return {sentryApp, install};
  }

  getUrl() {
    const components = this.state.components.filter(c => c.type == 'stacktrace-link');
    const {filename, lineNo, project} = this.props;

    const {sentryApp, install} = this.getInstallApp(components[0]);
    const {host, protocol} = parseurl({url: sentryApp.webhookUrl});
    const urlBase = `${protocol}//${host}`;
    const queryParams = {
      lineNo,
      filename,
      projectSlug: project.slug,
      installationId: install.id,
    };
    const query = qs.stringify(queryParams);
    const uri = components[0].schema.uri;
    return `${urlBase}${uri}?${query}`;
  }

  render() {
    const {components, installs, sentryApps} = this.state;
    if (!components.length || !installs.length || !sentryApps.length) {
      return null;
    }

    const url = this.getUrl();
    return (
      <StyledButtonContainer>
        <StyledButton href={url} size="small" priority="primary">
          {`Debug In ${components[0].sentryApp.name}`}
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
  z-index: ${p => p.theme.zIndex.header};
  height: 36px;
  line-height: 1.5;
  padding: 0px 5px;
  top: -31px;
  right: 30px;
`;
