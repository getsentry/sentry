import React from 'react';
import PropTypes from 'prop-types';
import {Link} from 'react-router';
import {isEqual} from 'lodash';

import SentryTypes from 'app/sentryTypes';
import EventUserFeedback from 'app/components/events/userFeedback';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t} from 'app/locale';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {Panel} from 'app/components/panels';
import Pagination from 'app/components/pagination';
import withOrganization from 'app/utils/withOrganization';
import {fetchGroupUserReports} from './utils';

class GroupUserFeedback extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    group: SentryTypes.Group.isRequired,
    query: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      error: false,
      reportList: [],
      pageLinks: '',
    };
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (!isEqual(prevProps.query, this.props.query)) {
      this.fetchData();
    }
  }

  fetchData = () => {
    this.setState({
      loading: true,
      error: false,
    });

    fetchGroupUserReports(this.props.group.id, this.props.query)
      .then(([data, _, jqXHR]) => {
        this.setState({
          error: false,
          loading: false,
          reportList: data,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      })
      .catch(() => {
        this.setState({
          error: true,
          loading: false,
        });
      });
  };

  getUserFeedbackUrl() {
    const {organization, group} = this.props;

    return `/${organization.slug}/${group.project.slug}/settings/user-feedback/`;
  }

  render() {
    const {reportList} = this.state;
    const {organization, group} = this.props;

    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    if (reportList.length) {
      return (
        <div className="row">
          <div className="col-md-9">
            {reportList.map((item, idx) => {
              return (
                <EventUserFeedback
                  key={idx}
                  report={item}
                  projectId={group.project.slug}
                  orgId={organization.slug}
                  issueId={group.id}
                />
              );
            })}
            <Pagination pageLinks={this.state.pageLinks} />
          </div>
        </div>
      );
    }

    const emptyStateMessage = isEqual(this.props.query, {})
      ? t('No user reports match your selected filters.')
      : t('No user reports have been collected.');

    return (
      <Panel>
        <EmptyStateWarning>
          <p>{emptyStateMessage}</p>
          <p>
            <Link to={this.getUserFeedbackUrl()}>
              {t('Learn how to integrate User Feedback')}
            </Link>
          </p>
        </EmptyStateWarning>
      </Panel>
    );
  }
}

export default withOrganization(GroupUserFeedback);
