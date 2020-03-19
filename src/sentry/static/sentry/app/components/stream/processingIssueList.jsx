import React from 'react';
import isEqual from 'lodash/isEqual';
import PropTypes from 'prop-types';

import {Client} from 'app/api';
import {fetchProcessingIssues} from 'app/actionCreators/processingIssues';
import ProcessingIssueHint from 'app/components/stream/processingIssueHint';
import SentryTypes from 'app/sentryTypes';

class ProcessingIssueList extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    projectIds: PropTypes.array,
    showProject: PropTypes.bool,
  };

  static defaultProps = {
    showProject: false,
  };

  constructor(props) {
    super(props);
    this.api = new Client();
    this.state = {
      loading: true,
      issues: [],
    };
  }

  componentDidMount() {
    this.fetchIssues();
  }

  componentDidUpdate(prevProps) {
    if (!isEqual(prevProps.projectIds, this.props.projectIds)) {
      this.fetchIssues();
    }
  }

  componentWillUnmount() {
    this.api.clear();
  }

  fetchIssues() {
    const {organization, projectIds} = this.props;
    const promise = fetchProcessingIssues(this.api, organization.slug, projectIds);

    promise.then(
      data => {
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
