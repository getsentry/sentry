import {Client} from 'app/api';
import {Group} from 'app/types';
import React from 'react';

type State = {
  loading: boolean;
  issues: null | Group[];
  error: null | Error;
};

type Props = {
  api: Client;
  // If issueIds is not defined, then we are in loading state
  issueIds?: string[];
  children: (renderProps: State) => React.ReactNode;
};

class IssuesFetcher extends React.PureComponent<Props, State> {
  state: State = {
    loading: true,
    issues: null,
    error: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.issueIds !== this.props.issueIds) {
      this.fetchData();
    }
  }

  fetchData = async () => {
    const {api, issueIds} = this.props;

    this.setState({loading: true});

    if (!issueIds) {
      return;
    }

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

function findIssueById(api: Client, issueId: string) {
  return api.requestPromise(`/issues/${issueId}/`);
}

export default IssuesFetcher;
