import PropTypes from 'prop-types';
import React from 'react';

class IssuesFetcher extends React.PureComponent {
  static propTypes = {
    api: PropTypes.object,
    issueIds: PropTypes.arrayOf(PropTypes.string),
  };

  state = {
    loading: true,
    issues: null,
    error: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.issueIds !== this.props.issueIds) {
      this.fetchData();
    }
  }

  fetchData = async () => {
    const {api, issueIds} = this.props;

    if (!issueIds) {
      return;
    }

    this.setState({loading: true});

    try {
      const issues = await Promise.all(
        issueIds.map(issueId => findIssueById(api, issueId))
      );
      this.setState({
        loading: false,
        issues,
      });
    } catch (error) {
      console.error(error); // eslint-disable-line no-console
      this.setState({loading: false, error});
    }
  };

  render() {
    return this.props.children(this.state);
  }
}

function findIssueById(api, issueId) {
  return api.requestPromise(`/issues/${issueId}/`);
}

export default IssuesFetcher;
