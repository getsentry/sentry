import {Component, Fragment} from 'react';
import isEqual from 'lodash/isEqual';

import {fetchProcessingIssues} from 'sentry/actionCreators/processingIssues';
import {Client} from 'sentry/api';
import ProcessingIssueHint from 'sentry/components/stream/processingIssueHint';
import {Organization, ProcessingIssue} from 'sentry/types';

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

class ProcessingIssueList extends Component<Props, State> {
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
      (data?: ProcessingIssue[]) => {
        const hasIssues = data?.some(
          p => p.hasIssues || p.resolveableIssues > 0 || p.issuesProcessing > 0
        );

        if (data && hasIssues) {
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
      <Fragment>
        {issues.map((p, idx) => (
          <ProcessingIssueHint
            key={idx}
            issue={p}
            projectId={p.project}
            orgId={organization.slug}
            showProject={showProject}
          />
        ))}
      </Fragment>
    );
  }
}

export default ProcessingIssueList;
