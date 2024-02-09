import {Component} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type SplitDiff from 'sentry/components/splitDiff';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import getStacktraceBody from 'sentry/utils/getStacktraceBody';
import withApi from 'sentry/utils/withApi';

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
  organization?: Organization;
  targetEventId?: string;
};

type State = {
  baseEvent: Array<string>;
  loading: boolean;
  targetEvent: Array<string>;
  SplitDiffAsync?: typeof SplitDiff;
};

class IssueDiff extends Component<Props, State> {
  static defaultProps: DefaultProps = defaultProps;

  state: State = {
    loading: true,
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
    const {
      baseIssueId,
      targetIssueId,
      baseEventId,
      targetEventId,
      organization,
      project,
    } = this.props;
    const hasSimilarityEmbeddingsFeature = project.features.includes(
      'similarity-embeddings'
    );

    // Fetch component and event data
    const asyncFetch = async () => {
      try {
        const splitdiffPromise = import('../splitDiff');
        const {default: SplitDiffAsync} = await splitdiffPromise;

        const [baseEventData, targetEventData] = await Promise.all([
          this.fetchEvent(baseIssueId, baseEventId ?? 'latest'),
          this.fetchEvent(targetIssueId, targetEventId ?? 'latest'),
        ]);

        const [baseEvent, targetEvent] = await Promise.all([
          getStacktraceBody(baseEventData),
          getStacktraceBody(targetEventData),
        ]);

        this.setState({
          SplitDiffAsync,
          baseEvent,
          targetEvent,
          loading: false,
        });
        if (organization && hasSimilarityEmbeddingsFeature) {
          trackAnalytics('issue_details.similar_issues.diff_clicked', {
            organization,
            project_id: baseEventData?.projectID,
            group_id: baseEventData?.groupID,
            error_message: baseEventData?.message
              ? baseEventData.message
              : baseEventData?.title,
            stacktrace: baseEvent.join('/n '),
            transaction: this.getTransaction(
              baseEventData?.tags ? baseEventData.tags : []
            ),
            parent_group_id: targetEventData?.groupID,
            parent_error_message: targetEventData?.message
              ? targetEventData.message
              : targetEventData?.title,
            parent_stacktrace: targetEvent.join('/n '),
            parent_transaction: this.getTransaction(
              targetEventData?.tags ? targetEventData.tags : []
            ),
          });
        }
      } catch {
        addErrorMessage(t('Error loading events'));
      }
    };

    asyncFetch();
  }

  fetchEvent = async (issueId: string, eventId: string) => {
    const {orgId, project, api} = this.props;

    let paramEventId = eventId;

    if (eventId === 'latest') {
      const event = await api.requestPromise(`/issues/${issueId}/events/latest/`);
      paramEventId = event.eventID;
    }

    const event = await api.requestPromise(
      `/projects/${orgId}/${project.slug}/events/${paramEventId}/`
    );
    return event;
  };

  getTransaction = (tags: any[]) => {
    return tags.find(tag => tag.key === 'transaction');
  };

  render() {
    const {className} = this.props;
    const {SplitDiffAsync: DiffComponent, loading, baseEvent, targetEvent} = this.state;

    return (
      <StyledIssueDiff className={className} loading={loading}>
        {loading && <LoadingIndicator />}
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
