import React from 'react';
import isEqual from 'lodash/isEqual';
import PropTypes from 'prop-types';

import {Client} from 'app/api';
import {Organization, ProcessingIssue} from 'app/types';
import {fetchProcessingIssues} from 'app/actionCreators/processingIssues';
import ProcessingIssueHint from 'app/components/stream/processingIssueHint';
import SentryTypes from 'app/sentryTypes';

const defaultProps = {
  showProject: false,
};

type Props = {
  organization: Organization;
  projectIds: string[];
} & typeof defaultProps;

type State = {
  issues: ProcessingIssue[];
  loading: boolean;
};

class ProcessingIssueList extends React.Component<Props, State> {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    projectIds: PropTypes.array,
    showProject: PropTypes.bool,
  };

  static defaultProps = defaultProps;

  state: State = {
    loading: true,
    issues: [],
  };

  componentDidMount() {
    this.fetchIssues();
  }

  componentDidUpdate(prevProps: Props) {
    if (!isEqual(prevProps.projectIds, this.props.projectIds)) {
      this.fetchIssues();
    }
  }

  componentWillUnmount() {
    this.api.clear();
  }

  api = new Client();

  fetchIssues() {
    const {organization, projectIds} = this.props;
    const promise = fetchProcessingIssues(this.api, organization.slug, projectIds);

    promise.then(
      (data: ProcessingIssue[]) => {
        const hasIssues = data.some(
          p => p.hasIssues || p.resolveableIssues > 0 || p.issuesProcessing > 0
        );

        if (hasIssues) {
          this.setState({issues: data});
        }
      },
      () => {
        // this is okay. it's just a ui hint
      }
    );
  }

  render() {
    const {issues} = this.state;
    const {organization, showProject} = this.props;

    return (
      <React.Fragment>
        {issues.map((p, idx) => (
          <ProcessingIssueHint
            key={idx}
            issue={p}
            projectId={p.project}
            orgId={organization.slug}
            showProject={showProject}
          />
        ))}
      </React.Fragment>
    );
  }
}

export default ProcessingIssueList;
