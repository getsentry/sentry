import {Component} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SplitDiff from 'sentry/components/splitDiff';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import getStacktraceBody from 'sentry/utils/getStacktraceBody';
import withApi from 'sentry/utils/withApi';

import renderGroupingInfo from './renderGroupingInfo';

const defaultProps = {
  baseEventId: 'latest',
  targetEventId: 'latest',
};

type DefaultProps = typeof defaultProps;

type Props = {
  api: Client;
  baseIssueId: string;
  orgId: string;
  project: Project;
  targetIssueId: string;
  baseEventId?: string;
  className?: string;
  targetEventId?: string;
};

type State = {
  baseEvent: Array<string>;
  groupingDiff: boolean;
  loading: boolean;
  targetEvent: Array<string>;
  SplitDiffAsync?: typeof SplitDiff;
};

class IssueDiff extends Component<Props, State> {
  static defaultProps: DefaultProps = defaultProps;

  state: State = {
    loading: true,
    groupingDiff: false,
    baseEvent: [],
    targetEvent: [],

    // `SplitDiffAsync` is an async-loaded component
    // This will eventually contain a reference to the exported component from `./splitDiff`
    SplitDiffAsync: undefined,
  };

  componentDidMount() {
    this.fetchData();
  }

  fetchData() {
    const {baseIssueId, targetIssueId, baseEventId, targetEventId} = this.props;

    // Fetch component and event data
    Promise.all([
      import('../splitDiff'),
      this.fetchEventData(baseIssueId, baseEventId ?? 'latest'),
      this.fetchEventData(targetIssueId, targetEventId ?? 'latest'),
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
    this.setState(
      state => ({groupingDiff: !state.groupingDiff, loading: true}),
      this.fetchData
    );
  };

  fetchEventData = async (issueId: string, eventId: string) => {
    const {orgId, project, api} = this.props;
    const {groupingDiff} = this.state;

    let paramEventId = eventId;

    if (eventId === 'latest') {
      const event = await api.requestPromise(`/issues/${issueId}/events/latest/`);
      paramEventId = event.eventID;
    }

    if (groupingDiff) {
      const groupingInfo = await api.requestPromise(
        `/projects/${orgId}/${project.slug}/events/${paramEventId}/grouping-info/`
      );
      return renderGroupingInfo(groupingInfo);
    }

    const event = await api.requestPromise(
      `/projects/${orgId}/${project.slug}/events/${paramEventId}/`
    );
    return getStacktraceBody(event);
  };

  render() {
    const {className, project} = this.props;
    const {
      SplitDiffAsync: DiffComponent,
      loading,
      groupingDiff,
      baseEvent,
      targetEvent,
    } = this.state;

    const showDiffToggle = project.features.includes('similarity-view-v2');

    return (
      <StyledIssueDiff className={className} loading={loading}>
        {loading && <LoadingIndicator />}
        {!loading && showDiffToggle && (
          <HeaderWrapper>
            <ButtonBar merged active={groupingDiff ? 'grouping' : 'event'}>
              <Button barId="event" size="sm" onClick={this.toggleDiffMode}>
                {t('Diff stack trace and message')}
              </Button>
              <Button barId="grouping" size="sm" onClick={this.toggleDiffMode}>
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
              target={targetEvent[i] ?? ''}
              type="words"
            />
          ))}
      </StyledIssueDiff>
    );
  }
}

export default withApi(IssueDiff);

// required for tests which do not provide API as context
export {IssueDiff};

const StyledIssueDiff = styled('div', {
  shouldForwardProp: p => typeof p === 'string' && isPropValid(p) && p !== 'loading',
})<Pick<State, 'loading'>>`
  background-color: ${p => p.theme.backgroundSecondary};
  overflow: auto;
  padding: ${space(1)};
  flex: 1;
  display: flex;
  flex-direction: column;

  ${p =>
    p.loading &&
    `
        background-color: ${p.theme.background};
        justify-content: center;
        align-items: center;
      `};
`;

const HeaderWrapper = styled('div')`
  display: flex;
  align-items: center;
  margin-bottom: ${space(2)};
`;
