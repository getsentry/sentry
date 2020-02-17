import {css} from '@emotion/core';
import PropTypes from 'prop-types';
import React from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import withApi from 'app/utils/withApi';
import LoadingIndicator from 'app/components/loadingIndicator';
import getStacktraceBody from 'app/utils/getStacktraceBody';

class IssueDiff extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    baseIssueId: PropTypes.string.isRequired,
    targetIssueId: PropTypes.string.isRequired,
    baseEventId: PropTypes.string.isRequired,
    targetEventId: PropTypes.string.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
  };

  static defaultProps = {
    baseEventId: 'latest',
    targetEventId: 'latest',
  };

  constructor(...args) {
    super(...args);
    this.state = {
      loading: true,
      baseEvent: {},
      targetEvent: {},

      // `SplitDiffAsync` is an async-loaded component
      // This will eventually contain a reference to the exported component from `./splitDiff`
      SplitDiffAsync: null,
    };
  }

  componentDidMount() {
    const {baseIssueId, targetIssueId, baseEventId, targetEventId} = this.props;

    // Fetch component and event data
    Promise.all([
      import(/* webpackChunkName: "splitDiff" */ './splitDiff'),
      this.fetchData(baseIssueId, baseEventId),
      this.fetchData(targetIssueId, targetEventId),
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

  getEndpoint(issueId, eventId) {
    const {orgId, projectId} = this.props;

    if (eventId !== 'latest') {
      return `/projects/${orgId}/${projectId}/events/${eventId}/`;
    }

    return `/issues/${issueId}/events/${eventId}/`;
  }

  fetchData(issueId, eventId) {
    return this.props.api.requestPromise(this.getEndpoint(issueId, eventId));
  }

  render() {
    const {className} = this.props;
    const DiffComponent = this.state.SplitDiffAsync;
    const diffReady = !this.state.loading && !!DiffComponent;

    return (
      <StyledIssueDiff className={className} loading={this.state.loading}>
        {this.state.loading && <LoadingIndicator />}
        {diffReady &&
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

const StyledIssueDiff = styled('div', {
  shouldForwardProp: p => isPropValid(p) && p !== 'loading',
})`
  background-color: #f7f8f9;
  overflow: auto;
  padding: 10px;
  flex: 1;
  display: flex;
  flex-direction: column;

  ${getLoadingStyle};
`;
