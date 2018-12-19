import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import Alert from 'app/components/alert';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import withOrganization from 'app/utils/withOrganization';
import space from 'app/styles/space';

import ReleaseHeader from '../shared/releaseHeader';
import {getRelease} from '../shared/utils';

class OrganizationReleaseDetails extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  static childContextTypes = {
    release: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      release: null,
      loading: true,
      error: false,
    };
  }

  getChildContext() {
    return {
      release: this.state.release,
    };
  }

  componentDidMount() {
    this.fetchData();
  }

  getTitle() {
    const {params: {version}, organization} = this.props;
    return `Release ${version} | ${organization.slug}`;
  }

  fetchData() {
    this.setState({
      loading: true,
      error: false,
    });

    const {orgId, version} = this.props.params;

    getRelease(orgId, version)
      .then(release => {
        this.setState({loading: false, release});
      })
      .catch(() => {
        this.setState({loading: false, error: true});
      });
  }

  renderNoAccess() {
    return (
      <Content>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </Content>
    );
  }

  renderContent() {
    const release = this.state.release;
    const {orgId, projectId} = this.props.params;

    if (!new Set(this.props.organization.features).has('sentry10')) {
      return this.renderNoAccess();
    }
    if (this.state.loading) return <LoadingIndicator />;
    if (this.state.error) return <LoadingError onRetry={this.fetchData} />;

    return (
      <Content>
        <ReleaseHeader release={release} orgId={orgId} projectId={projectId} />
        {/*React.cloneElement(this.props.children, {
          release,
          environment: this.props.environment,
        })*/}
      </Content>
    );
  }

  render() {
    return <DocumentTitle title={this.getTitle()}>{this.renderContent()}</DocumentTitle>;
  }
}

export default withOrganization(OrganizationReleaseDetails);

const Content = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  padding: ${space(2)} ${space(4)} ${space(3)};
  margin-bottom: -20px; /* <footer> has margin-top: 20px; */
`;
