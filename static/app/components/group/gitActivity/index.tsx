import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Clipboard from 'app/components/clipboard';
import LoadingIndicator from 'app/components/loadingIndicator';
import TextOverflow from 'app/components/textOverflow';
import Tooltip from 'app/components/tooltip';
import {IconCopy, IconRefresh} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';

import SidebarSection from '../sidebarSection';

import Activity from './activity';
import UnlinkedActivity from './unlinked';

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

function GitActivity({api, issueId}: Props) {
  const [linkedActivities, setLinkedActivities] = useState<GitActivity[]>([]);
  const [unlinkedActivities, setUnlinkedActivities] = useState<GitActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<undefined | string>(undefined);
  const [branchName, setBranchName] = useState('');

  useEffect(() => {
    fetchBranchName();
    fetchActivities();
  }, []);

  async function fetchBranchName(reload = true) {
    if (reload) {
      setIsLoading(true);
    }

    try {
      const response = await api.requestPromise(`/issues/${issueId}/branch-name/`);
      setBranchName(response.branchName);
      setIsLoading(false);
    } catch {
      setIsLoading(false);
      setError(t('An error occurred while fetching the branch name'));
    }
  }

  async function fetchActivities() {
    setIsLoading(true);
    setError(undefined);
    try {
      const response: GitActivity[] = await api.requestPromise(
        `/issues/${issueId}/github-activity/`
      );
      const activities = response.filter(gitActivity => gitActivity.visible);
      setLinkedActivities(activities);
      const unlinked = response.filter(gitActivity => !gitActivity.visible);
      setUnlinkedActivities(unlinked);
      setIsLoading(false);
    } catch {
      setIsLoading(false);
      setError(t('An error occurred while fetching Git Manager'));
    }
  }

  async function handleUnlinkPullRequest(gitActivity: GitActivity) {
    try {
      api.requestPromise(`/issues/${issueId}/github-activity/${gitActivity.id}/`, {
        method: 'PUT',
        data: {visible: 0},
      });
      const newActivities = linkedActivities.filter(
        activity => activity.id !== gitActivity.id
      );
      setLinkedActivities(newActivities);
      unlinkedActivities.push(gitActivity);
      setUnlinkedActivities(unlinkedActivities);
      addSuccessMessage(t('Pull Request was successfully unlinked'));
    } catch {
      addErrorMessage(t('An error occurred while unlinkig the Pull Request'));
    }
  }

  async function handleRelinkPullRequest(gitActivity: GitActivity) {
    try {
      api.requestPromise(`/issues/${issueId}/github-activity/${gitActivity.id}/`, {
        method: 'PUT',
        data: {visible: 1},
      });
      linkedActivities.push(gitActivity);
      setLinkedActivities(linkedActivities);

      const newUnlinkedActivities = unlinkedActivities.filter(
        activity => activity.id !== gitActivity.id
      );
      setUnlinkedActivities(newUnlinkedActivities);
      addSuccessMessage(t('Pull Request was successfully linked'));
    } catch {
      addErrorMessage(t('An error occurred while linkig the Pull Request'));
    }
  }

  function renderContent() {
    if (error) {
      return <Alert type="error">{error}</Alert>;
    }

    if (isLoading) {
      return <LoadingIndicator mini />;
    }

    return (
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
              <StyledIconRefresh onClick={() => fetchBranchName(false)} />
            </Tooltip>
          </BranchNameAndActions>
        </IssueId>
        <Activities>
          {linkedActivities.map(activity => (
            <Activity
              key={activity.id}
              gitActivity={activity}
              onUnlink={handleUnlinkPullRequest}
            />
          ))}
        </Activities>
        {unlinkedActivities.length > 0 && (
          <UnlinkedActivity
            unlinkedActivities={unlinkedActivities}
            onRelink={handleRelinkPullRequest}
          />
        )}
      </Fragment>
    );
  }

  return <SidebarSection title={t('Git Manager')}>{renderContent()}</SidebarSection>;
}

export default GitActivity;

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
