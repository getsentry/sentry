import React from 'react';
import {RouteComponentProps} from 'react-router';
import isEqual from 'lodash/isEqual';

import EventUserFeedback from 'app/components/events/userFeedback';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import {Panel} from 'app/components/panels';
import {Group, Organization, Project, UserReport} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import UserFeedbackEmpty from 'app/views/userFeedback/userFeedbackEmpty';

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

class GroupUserFeedback extends React.Component<Props, State> {
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
      .then(([data, _, jqXHR]) => {
        this.setState({
          error: false,
          loading: false,
          reportList: data,
          pageLinks: jqXHR?.getResponseHeader('Link'),
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

    return (
      <Panel>
        <UserFeedbackEmpty projectIds={[group.project.id]} />
      </Panel>
    );
  }
}

export default withOrganization(GroupUserFeedback);
