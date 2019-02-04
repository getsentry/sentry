import React from 'react';
import {isEqual} from 'lodash';
import PropTypes from 'prop-types';

import {Client} from 'app/api';
import {logAjaxError} from 'app/utils/logging';
import {
  fetchProcessingIssues,
  fetchProjectProcessingIssues,
} from 'app/actionCreators/processingIssues';
import ProcessingIssueHint from 'app/components/stream/processingIssueHint';
import SentryTypes from 'app/sentryTypes';

class ProcessingIssueList extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    project: SentryTypes.Project,
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

  componentDidUpdate(prevProps, prevState) {
    if (!isEqual(prevProps.projectIds, this.props.projectIds)) {
      this.fetchIssues();
    }
  }

  componentWillUnmount() {
    this.api.clear();
  }

  fetchIssues() {
    const {organization, project, projectIds} = this.props;
    let promise;
    if (project) {
      promise = fetchProjectProcessingIssues(this.api, organization.slug, project.slug);
    } else {
      promise = fetchProcessingIssues(this.api, organization.slug, projectIds);
    }

    promise.then(
      data => {
        const hasIssues = data.some(
          p => p.hasIssues || p.resolveableIssues > 0 || p.issuesProcessing > 0
        );

        if (hasIssues) {
          this.setState({issues: data});
        }
      },
      error => {
        // this is okay. it's just a ui hint
        logAjaxError(error);
      }
    );
  }

  render() {
    const {issues} = this.state;
    const {organization, showProject} = this.props;

    return (
      <React.Fragment>
        {issues.map((p, idx) => {
          return (
            <ProcessingIssueHint
              key={idx}
              issue={p}
              projectId={p.project}
              orgId={organization.slug}
              showProject={showProject}
            />
          );
        })}
      </React.Fragment>
    );
  }
}

export default ProcessingIssueList;
