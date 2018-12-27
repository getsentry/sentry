import React from 'react';
// import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {isEqual} from 'lodash';

import {t} from 'app/locale';
import withOrganization from 'app/utils/withOrganization';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import SentryTypes from 'app/sentryTypes';
import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import CompactIssue from 'app/components/compactIssue';
import EventUserFeedback from 'app/components/events/userFeedback';
import space from 'app/styles/space';

import UserFeedbackContainer from './container';
import {fetchUserFeedback, getQuery} from './utils';

class OrganizationUserFeedback extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    // selection: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {reportList: [], loading: true, error: false, pageLinks: ''};
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (
      !isEqual(getQuery(prevProps.location.search), getQuery(this.props.location.search))
    ) {
      this.fetchData();
    }
  }

  fetchData = () => {
    this.setState({loading: true, error: false});

    const query = getQuery(this.props.location.search);

    fetchUserFeedback(this.props.organization, query)
      .then(([reportList, _, jqXHR]) => {
        this.setState({
          reportList,
          loading: false,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      })
      .catch(() => this.setState({error: true, loading: false}));
  };

  renderNoAccess() {
    return <Alert type="warning">{t("You don't have access to this feature")}</Alert>;
  }

  renderEmpty() {
    return (
      <EmptyStateWarning>
        <p>{t('Sorry, no results match your serch query.')}</p>
      </EmptyStateWarning>
    );
  }

  renderList() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    }

    if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    if (this.state.reportList.length === 0) {
      return this.renderEmpty();
    }

    return this.renderResults();
  }

  renderResults() {
    const {orgId} = this.props.params;

    const children = this.state.reportList.map(item => {
      const issue = item.issue;
      const projectId = issue.project.slug;
      return (
        <CompactIssue
          key={item.id}
          id={issue.id}
          data={issue}
          orgId={orgId}
          projectId={projectId}
        >
          <EventUserFeedback
            report={item}
            orgId={orgId}
            projectId={projectId}
            issueId={issue.id}
          />
        </CompactIssue>
      );
    });

    return children;
  }

  render() {
    const {status} = getQuery(this.props.location.search);
    return (
      <Content>
        <Feature
          features={['organizations:sentry10']}
          organization={this.props.organization}
          renderDisabled={this.renderNoAccess}
        >
          <UserFeedbackContainer
            location={this.props.location}
            pageLinks={this.state.pageLinks}
            status={status}
          >
            {this.renderList()}
          </UserFeedbackContainer>
        </Feature>
      </Content>
    );
  }
}

const Content = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  padding: ${space(2)} ${space(4)} ${space(3)};
  margin-bottom: -20px; /* <footer> has margin-top: 20px; */
`;

export default withOrganization(withGlobalSelection(OrganizationUserFeedback));
