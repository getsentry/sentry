import {Component} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {EventUserFeedback} from 'sentry/components/events/userFeedback';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {space} from 'sentry/styles/space';
import {Group, Organization, Project, UserReport} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import {UserFeedbackEmpty} from 'sentry/views/userFeedback/userFeedbackEmpty';

import {fetchGroupUserReports} from './utils';

type RouteParams = {
  groupId: string;
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  environments: string[];
  group: Group;
  organization: Organization;
  project: Project;
};

type State = {
  error: boolean;
  loading: boolean;
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
    const {group, location, organization, params} = this.props;
    this.setState({
      loading: true,
      error: false,
    });

    fetchGroupUserReports(organization.slug, group.id, {
      ...params,
      cursor: location.query.cursor || '',
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
        <Layout.Body>
          <Layout.Main>
            {reportList.map((item, idx) => (
              <StyledEventUserFeedback
                key={idx}
                report={item}
                orgSlug={organization.slug}
                issueId={group.id}
              />
            ))}
            <Pagination pageLinks={this.state.pageLinks} {...this.props} />
          </Layout.Main>
        </Layout.Body>
      );
    }

    return (
      <Layout.Body>
        <Layout.Main fullWidth>
          <UserFeedbackEmpty projectIds={[group.project.id]} />
        </Layout.Main>
      </Layout.Body>
    );
  }
}

const StyledEventUserFeedback = styled(EventUserFeedback)`
  margin-bottom: ${space(2)};
`;

export default withOrganization(GroupUserFeedback);
