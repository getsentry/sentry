import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import Clipboard from 'app/components/clipboard';
import ExternalLink from 'app/components/links/externalLink';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import QuestionTooltip from 'app/components/questionTooltip';
import TextOverflow from 'app/components/textOverflow';
import Tooltip from 'app/components/tooltip';
import {IconBroadcast, IconCopy, IconRefresh} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import useInterval from 'app/utils/useInterval';
import useVisibilityState from 'app/utils/useVisibilityState';

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

function GitManager({api, issueId}: Props) {
  const [linkedActivities, setLinkedActivities] = useState<GitActivity[]>([]);
  const [unlinkedActivities, setUnlinkedActivities] = useState<GitActivity[]>([]);
  const [error, setError] = useState<undefined | string>(undefined);
  const [branchName, setBranchName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [intervalDelay, setIntervalDelay] = useState<null | number>(POLLER_DELAY);
  const visibilityState = useVisibilityState();

  useEffect(() => {
    fetchBranchName();
  }, []);

  useEffect(() => {
    visibilityChange();
  }, [visibilityState]);

  useInterval(() => {
    fetchActivities();
  }, intervalDelay);

  function visibilityChange() {
    if (visibilityState === 'hidden') {
      setIntervalDelay(null);
      return;
    }

    setIntervalDelay(POLLER_DELAY);
  }

  async function fetchBranchName() {
    try {
      const response = await api.requestPromise(`/issues/${issueId}/branch-name/`);
      setBranchName(response.branchName);
      setError(undefined);
    } catch {
      setError(t('An error occurred while fetching the branch name suggestion'));
    }
  }

  async function fetchActivities() {
    try {
      const response: GitActivity[] = await api.requestPromise(
        `/issues/${issueId}/github-activity/`
      );
      const activities = response.filter(gitActivity => gitActivity.visible);
      setLinkedActivities(activities);
      const unlinked = response.filter(gitActivity => !gitActivity.visible);
      setUnlinkedActivities(unlinked);
      setError(undefined);
      setIsLoading(false);
    } catch {
      setError(t('An error occurred while fetching Git Manager'));
      setIntervalDelay(null);
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
      return (
        <LoadingError
          withIcon={false}
          message={error}
          onRetry={() => setIntervalDelay(POLLER_DELAY)}
        />
      );
    }

    if (isLoading) {
      return <LoadingIndicator mini />;
    }

    // TODO(git-hackers): Update doc link
    return (
      <Fragment>
        {branchName && (
          <Header>
            <Title>
              {t('Branch Name Suggestion')}
              <QuestionTooltip
                isHoverable
                position="top"
                size="sm"
                containerDisplayMode="block"
                title={tct(
                  'By copying this branch name suggestion and pushing it to Github, this issue will automatically be linked. [link]',
                  {
                    link: (
                      <ExternalLink href="https://docs.sentry.io/platforms/javascript/install/">
                        {t('Read the docs')}
                      </ExternalLink>
                    ),
                  }
                )}
              />
            </Title>
            <BranchNameAndActions>
              <StyledTooltip title={branchName}>
                <BranchName>{branchName}</BranchName>
              </StyledTooltip>
              <Clipboard value={branchName}>
                <Tooltip
                  title={t('Copy branch name suggestion')}
                  containerDisplayMode="inline-flex"
                >
                  <StyledIconCopy />
                </Tooltip>
              </Clipboard>
              <Tooltip
                title={t('Refresh to get a new branch name suggestion')}
                containerDisplayMode="inline-flex"
              >
                <StyledIconRefresh onClick={() => fetchBranchName()} />
              </Tooltip>
            </BranchNameAndActions>
          </Header>
        )}
        {!!linkedActivities.length && (
          <Activities>
            {linkedActivities.map(activity => (
              <Activity
                key={activity.id}
                gitActivity={activity}
                onUnlink={handleUnlinkPullRequest}
              />
            ))}
          </Activities>
        )}
        {!!unlinkedActivities.length && (
          <UnlinkedActivity
            unlinkedActivities={unlinkedActivities}
            onRelink={handleRelinkPullRequest}
          />
        )}
        {!linkedActivities.length && !unlinkedActivities.length && (
          <EmptyState>
            <IconBroadcast />
            {t('Waiting for git activities\u2026')}
          </EmptyState>
        )}
      </Fragment>
    );
  }

  return <SidebarSection title={t('Git Manager')}>{renderContent()}</SidebarSection>;
}

export default GitManager;

const Header = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  display: grid;
  grid-gap: ${space(0.5)};
  margin-bottom: ${space(2)};
  font-weight: 700;
`;

const Title = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  grid-gap: ${space(0.5)};
  align-items: center;
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

const EmptyState = styled('div')`
  display: grid;
  align-items: center;
  justify-content: center;
  grid-template-columns: repeat(2, max-content);
  grid-gap: ${space(1)};
  color: ${p => p.theme.gray300};
  text-align: center;
`;
