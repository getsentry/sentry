import {css} from '@emotion/core';
import React from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import withApi from 'app/utils/withApi';
import LoadingIndicator from 'app/components/loadingIndicator';
import getStacktraceBody from 'app/utils/getStacktraceBody';
import SplitDiff from 'app/components/splitDiff';

type Props = {
  api: Client;
  baseIssueId: string;
  targetIssueId: string;

  orgId: string;
  projectId: string;

  baseEventId?: string;
  targetEventId?: string;
  className?: string;
};

type State = {
  loading: boolean;
  baseEvent: Array<string>;
  targetEvent: Array<string>;
  SplitDiffAsync?: typeof SplitDiff;
};

class IssueDiff extends React.Component<Props, State> {
  static defaultProps = {
    baseEventId: 'latest',
    targetEventId: 'latest',
  };

  constructor(props: Props) {
    super(props);

    this.state = {
      loading: true,
      baseEvent: [],
      targetEvent: [],

      // `SplitDiffAsync` is an async-loaded component
      // This will eventually contain a reference to the exported component from `./splitDiff`
      SplitDiffAsync: undefined,
    };
  }

  componentDidMount() {
    const {baseIssueId, targetIssueId, baseEventId, targetEventId} = this.props;

    // Fetch component and event data
    Promise.all([
      import(/* webpackChunkName: "splitDiff" */ './splitDiff'),
      this.fetchData(baseIssueId, baseEventId || 'latest'),
      this.fetchData(targetIssueId, targetEventId || 'latest'),
    ])
      .then(([{default: SplitDiffAsync}, baseEvent, targetEvent]) => {
        this.setState({
          SplitDiffAsync,
          baseEvent: getStacktraceBody(baseEvent),
          targetEvent: getStacktraceBody(targetEvent),
          loading: false,
        });
      })
      .catch(() => {
        addErrorMessage(t('Error loading events'));
      });
  }

  getEndpoint(issueId: string, eventId: string) {
    const {orgId, projectId} = this.props;

    if (eventId !== 'latest') {
      return `/projects/${orgId}/${projectId}/events/${eventId}/`;
    }

    return `/issues/${issueId}/events/${eventId}/`;
  }

  fetchData(issueId: string, eventId: string) {
    return this.props.api.requestPromise(this.getEndpoint(issueId, eventId));
  }

  render() {
    const {className} = this.props;
    const DiffComponent = this.state.SplitDiffAsync;

    return (
      <StyledIssueDiff className={className} loading={this.state.loading}>
        {this.state.loading && <LoadingIndicator />}
        {!this.state.loading &&
          DiffComponent &&
          this.state.baseEvent.map((value, i) => (
            <DiffComponent
              key={i}
              base={value}
              target={this.state.targetEvent[i] || ''}
              type="words"
            />
          ))}
      </StyledIssueDiff>
    );
  }
}

export default withApi(IssueDiff);
export {IssueDiff};

const getLoadingStyle = p =>
  (p.loading &&
    css`
      background-color: white;
      justify-content: center;
    `) ||
  '';

type StyledIssueDiffProps = {
  loading: boolean;
};

const StyledIssueDiff = styled('div', {
  shouldForwardProp: p => isPropValid(p) && p !== 'loading',
})<StyledIssueDiffProps>`
  background-color: #f7f8f9;
  overflow: auto;
  padding: 10px;
  flex: 1;
  display: flex;
  flex-direction: column;

  ${getLoadingStyle};
`;
