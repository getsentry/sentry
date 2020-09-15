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
import ButtonBar from 'app/components/buttonBar';
import Button from 'app/components/button';
import space from 'app/styles/space';
import {Project} from 'app/types';

import renderGroupingInfo from './groupingDiff';

type Props = {
  api: Client;
  baseIssueId: string;
  targetIssueId: string;

  orgId: string;
  project: Project;

  baseEventId?: string;
  targetEventId?: string;
  className?: string;
};

type State = {
  loading: boolean;
  groupingDiff: boolean;
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
      groupingDiff: false,
      baseEvent: [],
      targetEvent: [],

      // `SplitDiffAsync` is an async-loaded component
      // This will eventually contain a reference to the exported component from `./splitDiff`
      SplitDiffAsync: undefined,
    };
  }

  componentDidMount() {
    this.fetchData();
  }

  fetchData() {
    const {baseIssueId, targetIssueId, baseEventId, targetEventId} = this.props;

    // Fetch component and event data
    Promise.all([
      import(/* webpackChunkName: "splitDiff" */ '../splitDiff'),
      this.fetchEventData(baseIssueId, baseEventId || 'latest'),
      this.fetchEventData(targetIssueId, targetEventId || 'latest'),
    ])
      .then(([{default: SplitDiffAsync}, baseEvent, targetEvent]) => {
        this.setState({
          SplitDiffAsync,
          baseEvent,
          targetEvent,
          loading: false,
        });
      })
      .catch(() => {
        addErrorMessage(t('Error loading events'));
      });
  }

  toggleDiffMode = () => {
    this.setState(state => ({groupingDiff: !state.groupingDiff, loading: true}), this.fetchData);
  }

  fetchEventData = async (issueId: string, eventId: string) => {
    const {orgId, project, api} = this.props;
    const {groupingDiff} = this.state;

    if (eventId === 'latest') {
      const event = await api.requestPromise(`/issues/${issueId}/events/latest/`);
      eventId = event.eventID;
    }

    if (groupingDiff) {
      const groupingInfo = await api.requestPromise(
        `/projects/${orgId}/${project.slug}/events/${eventId}/grouping-info/`
      );
      return renderGroupingInfo(groupingInfo);
    } else {
      const event = await api.requestPromise(
        `/projects/${orgId}/${project.slug}/events/${eventId}/`
      );
      return getStacktraceBody(event);
    }
  };

  render() {
    const {className, project} = this.props;
    const {SplitDiffAsync: DiffComponent, loading, groupingDiff, baseEvent, targetEvent} = this.state;

    const showDiffToggle = project.features.includes("similarity-view-v2");

    return (
      <StyledIssueDiff className={className} loading={loading}>
        {loading && <LoadingIndicator />}
        {!loading && showDiffToggle && (
          <HeaderWrapper>
            <ButtonBar merged active={groupingDiff ? 'grouping' : 'event'}>
              <Button barId="event" size="small" onClick={this.toggleDiffMode}>
                {t('Diff stacktrace and message')}
              </Button>
              <Button barId="grouping" size="small" onClick={this.toggleDiffMode}>
                {t('Diff grouping information')}
              </Button>
            </ButtonBar>
          </HeaderWrapper>
        )}
        {!loading &&
          DiffComponent &&
          baseEvent.map((value, i) => (
            <DiffComponent
              key={i}
              base={value}
              target={targetEvent[i] || ''}
              type="words"
            />
          ))}
      </StyledIssueDiff>
    );
  }
}

export default withApi(IssueDiff);

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

const HeaderWrapper = styled('div')`
  display: flex;
  align-items: center;
  margin-bottom: ${space(2)};
`;
