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

type GitActivity = Omit<React.ComponentProps<typeof Activity>, 'onUnlink'>;

type Props = {
  api: Client;
  issueId: string;
};

function GitActivity({api, issueId}: Props) {
  const [gitActivities, setGitActivities] = useState<GitActivity[]>([]);

  const [branchName, setBranchName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<undefined | string>(undefined);

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
      const response = await api.requestPromise(`/issues/${issueId}/github-activity/`);
      setGitActivities(response);
      setIsLoading(false);
    } catch {
      setIsLoading(false);
      setError(t('An error occurred while fetching Git Activity'));
    }
  }

  async function handleUnlinkPullRequest(pullRequestId: string) {
    setIsLoading(true);
    try {
      const response: {status: number; activities: GitActivity[]} = await new Promise(
        resolve => {
          setTimeout(() => {
            const newActivities = gitActivities.filter(
              gitActivity => gitActivity.id !== pullRequestId
            );
            resolve({
              status: 200,
              activities: newActivities,
            });
          }, 300);
        }
      );
      setGitActivities(response.activities);
      addSuccessMessage(t('Pull Request was successfully unlinked'));
    } catch {
      addErrorMessage(t('An error occurred while unlinkig the Pull Request'));
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
          {gitActivities.map(({id, ...gitActivity}) => (
            <Activity
              key={id}
              id={id}
              {...gitActivity}
              onUnlink={handleUnlinkPullRequest}
            />
          ))}
        </Activities>
      </Fragment>
    );
  }

  return <SidebarSection title={t('Git Activity')}>{renderContent()}</SidebarSection>;
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
