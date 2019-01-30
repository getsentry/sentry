import React from 'react';
import {isEqual} from 'lodash';
import PropTypes from 'prop-types';

import {Client} from 'app/api';
import {logAjaxError} from 'app/utils/logging';
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

  componentDidUpdate(prevProps, prevState) {
    if (!isEqual(prevProps.projectIds, this.props.projectIds)) {
      this.fetchIssues();
    }
  }

  componentWillUnmount() {
    this.api.clear();
  }

  fetchIssues() {
    let {organization, projectIds} = this.props;

    fetchProcessingIssues(this.api, organization.slug, projectIds).then(
      data => {
        let hasIssues = data.some(
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
    let {issues} = this.state;
    let {organization, showProject} = this.props;

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
