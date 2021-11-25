import {Component} from 'react';
import {RouteComponentProps} from 'react-router';
import isEqual from 'lodash/isEqual';

import EventUserFeedback from 'sentry/components/events/userFeedback';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {Group, Organization, Project, UserReport} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import UserFeedbackEmpty from 'sentry/views/userFeedback/userFeedbackEmpty';

import {fetchGroupUserReports} from './utils';

type RouteParams = {
  orgId: string;
  groupId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  group: Group;
  organization: Organization;
  project: Project;
  environments: string[];
};

type State = {
  loading: boolean;
  error: boolean;
  reportList: UserReport[];
  pageLinks?: string | null;
};

class GroupUserFeedback extends Component<Props, State> {
  state: State = {
    loading: true,
    error: false,
    reportList: [],
    pageLinks: '',
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    if (
      !isEqual(prevProps.params, this.props.params) ||
      prevProps.location.pathname !== this.props.location.pathname ||
      prevProps.location.search !== this.props.location.search
    ) {
      this.fetchData();
    }
  }

  fetchData = () => {
    this.setState({
      loading: true,
      error: false,
    });

    fetchGroupUserReports(this.props.group.id, {
      ...this.props.params,
      cursor: this.props.location.query.cursor || '',
    })
      .then(([data, _, resp]) => {
        this.setState({
          error: false,
          loading: false,
          reportList: data,
          pageLinks: resp?.getResponseHeader('Link'),
        });
      })
      .catch(() => {
        this.setState({
          error: true,
          loading: false,
        });
      });
  };

  render() {
    const {reportList, loading, error} = this.state;
    const {organization, group} = this.props;

    if (loading) {
      return <LoadingIndicator />;
    }

    if (error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    if (reportList.length) {
      return (
        <div className="row">
          <div className="col-md-9">
            {reportList.map((item, idx) => (
              <EventUserFeedback
                key={idx}
                report={item}
                orgId={organization.slug}
                issueId={group.id}
              />
            ))}
            <Pagination pageLinks={this.state.pageLinks} {...this.props} />
          </div>
        </div>
      );
    }

    return <UserFeedbackEmpty projectIds={[group.project.id]} />;
  }
}

export default withOrganization(GroupUserFeedback);
