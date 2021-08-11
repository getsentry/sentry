import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Clipboard from 'app/components/clipboard';
import TextOverflow from 'app/components/textOverflow';
import Tooltip from 'app/components/tooltip';
import {IconCopy, IconRefresh} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';

import SidebarSection from '../sidebarSection';

import Activity from './activity';
import UnlinkedActivity from './unlinked';

const POLLER_DELAY = 2000;

// https://docs.github.com/en/rest/reference/pulls
export type GitActivity = {
  id: string;
  url: string;
  title: string;
  // State of the Pull Request. Either open or closed
  state: 'open' | 'closed' | 'merged' | 'draft' | 'created' | 'closed';
  type: 'branch' | 'pull_request';
  author: string;
  visible: boolean;
};

type Props = {
  api: Client;
  issueId: string;
};

type State = {
  linkedActivities: GitActivity[];
  unlinkedActivities: GitActivity[];
  error: undefined | string;
  branchName: string;
};

class GitManager extends Component<Props, State> {
  state: State = {
    linkedActivities: [],
    unlinkedActivities: [],
    branchName: '',
    error: undefined,
  };

  componentDidMount() {
    this.fetchBranchName();
    this.fetchActivities();

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  componentWillUnmount() {
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.poller) {
      this.stopPoll();
    }
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  poller: number | null = null;
  timer: number | null = null;

  startPoll() {
    this.poller = window.setTimeout(this.fetchActivities, POLLER_DELAY);
  }

  stopPoll() {
    if (this.poller) {
      window.clearTimeout(this.poller);
      this.poller = null;
    }
  }

  fetchBranchName = async () => {
    const {api, issueId} = this.props;
    try {
      const response = await api.requestPromise(`/issues/${issueId}/branch-name/`);
      this.setState({
        branchName: response.branchName,
      });
    } catch {
      this.setState({
        error: t('An error occurred while fetching the branch name'),
      });
    }
  };

  fetchActivities = async () => {
    if (this.poller) {
      this.stopPoll();
    }

    const {api, issueId} = this.props;
    try {
      const response: GitActivity[] = await api.requestPromise(
        `/issues/${issueId}/github-activity/`
      );
      const activities = response.filter(gitActivity => gitActivity.visible);
      const unlinked = response.filter(gitActivity => !gitActivity.visible);
      this.setState({
        linkedActivities: activities,
        unlinkedActivities: unlinked,
      });
    } catch {
      this.setState({
        error: t('An error occurred while fetching the Git Activity'),
      });
    }

    this.startPoll();
  };

  handleVisibilityChange = () => (document.hidden ? this.stopPoll() : this.startPoll());

  handleUnlinkPullRequest = async (gitActivity: GitActivity) => {
    const {api, issueId} = this.props;
    const {linkedActivities, unlinkedActivities} = this.state;
    try {
      api.requestPromise(`/issues/${issueId}/github-activity/${gitActivity.id}/`, {
        method: 'PUT',
        data: {visible: 0},
      });
      const newActivities = linkedActivities.filter(
        activity => activity.id !== gitActivity.id
      );
      unlinkedActivities.push(gitActivity);
      this.setState({
        linkedActivities: newActivities,
        unlinkedActivities,
      });
      addSuccessMessage(t('Pull Request was successfully unlinked'));
    } catch {
      addErrorMessage(t('An error occurred while unlinkig the Pull Request'));
    }
  };

  handleRelinkPullRequest = async (gitActivity: GitActivity) => {
    const {api, issueId} = this.props;
    const {linkedActivities, unlinkedActivities} = this.state;
    try {
      api.requestPromise(`/issues/${issueId}/github-activity/${gitActivity.id}/`, {
        method: 'PUT',
        data: {visible: 1},
      });
      linkedActivities.push(gitActivity);
      const newUnlinkedActivities = unlinkedActivities.filter(
        activity => activity.id !== gitActivity.id
      );
      this.setState({
        linkedActivities,
        unlinkedActivities: newUnlinkedActivities,
      });
      addSuccessMessage(t('Pull Request was successfully linked'));
    } catch {
      addErrorMessage(t('An error occurred while linkig the Pull Request'));
    }
  };

  render() {
    const {error, branchName, linkedActivities, unlinkedActivities} = this.state;
    if (error) {
      return (
        <SidebarSection title={t('Git Activity')}>
          <Alert type="error">{error}</Alert>
        </SidebarSection>
      );
    }
    return (
      <SidebarSection title={t('Git Activity')}>
        <Fragment>
          <IssueId>
            {t('Branch Name')}
            <BranchNameAndActions>
              <StyledTooltip title={branchName}>
                <BranchName>{branchName}</BranchName>
              </StyledTooltip>
              <Clipboard value={branchName}>
                <Tooltip title={t('Copy branch name')} containerDisplayMode="inline-flex">
                  <StyledIconCopy />
                </Tooltip>
              </Clipboard>
              <Tooltip
                title={t('Refresh to get a new branch name')}
                containerDisplayMode="inline-flex"
              >
                <StyledIconRefresh onClick={() => this.fetchBranchName()} />
              </Tooltip>
            </BranchNameAndActions>
          </IssueId>
          <Activities>
            {linkedActivities.map(activity => (
              <Activity
                key={activity.id}
                gitActivity={activity}
                onUnlink={this.handleUnlinkPullRequest}
              />
            ))}
          </Activities>
          {unlinkedActivities.length > 0 && (
            <UnlinkedActivity
              unlinkedActivities={unlinkedActivities}
              onRelink={this.handleRelinkPullRequest}
            />
          )}
        </Fragment>
      </SidebarSection>
    );
  }
}

export default GitManager;

const IssueId = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  display: grid;
  grid-gap: ${space(0.5)};
  margin-bottom: ${space(2)};
  font-weight: 700;
`;

const BranchName = styled(TextOverflow)`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.textColor};
  background: ${p => p.theme.backgroundSecondary};
  padding: ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  font-weight: 400;
`;

const BranchNameAndActions = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content max-content;
  grid-gap: ${space(1.5)};
  align-items: center;
`;

const StyledIconCopy = styled(IconCopy)`
  cursor: pointer;
  color: ${p => p.theme.gray300};
  :hover {
    color: ${p => p.theme.gray500};
  }
`;

const StyledIconRefresh = styled(IconRefresh)`
  cursor: pointer;
  color: ${p => p.theme.gray300};
  :hover {
    color: ${p => p.theme.gray500};
  }
`;

const StyledTooltip = styled(Tooltip)`
  overflow: hidden;
`;

const Activities = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  margin: -${space(1)} 0;
  > * {
    &:nth-last-child(n + 4) {
      border-bottom: 1px solid ${p => p.theme.innerBorder};
    }
  }
`;
