import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import Clipboard from 'app/components/clipboard';
import ShortId from 'app/components/shortId';
import Tooltip from 'app/components/tooltip';
import {IconCopy} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';

import SidebarSection from '../sidebarSection';

import Activity from './activity';

// https://docs.github.com/en/rest/reference/pulls
type GitActivity = {
  id: string;
  url: string;
  title: string;
  // State of the Pull Request. Either open or closed
  state: 'open' | 'closed';
  merged: boolean;
  draft: boolean;
};

type Props = {
  shortId: string;
};

function GitActivity({shortId}: Props) {
  const [gitActivities, setGitActivities] = useState<GitActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, []);

  async function fetchActivities() {
    setIsLoading(true);
    try {
      const response: {status: number; activities: GitActivity[]} = await new Promise(
        resolve => {
          setTimeout(() => {
            resolve({
              status: 200,
              activities: [
                {
                  id: '1',
                  url: 'https://github.com/org/repo/pull/1',
                  title: 'rr/card-details-background-color',
                  state: 'open',
                  merged: false,
                  draft: true,
                },
                {
                  id: '2',
                  url: 'https://github.com/org/repo/pull/2',
                  title: 'fix(ui): fixed dark mode card details form',
                  state: 'open',
                  merged: false,
                  draft: false,
                },
                {
                  id: '3',
                  url: 'https://github.com/org/repo/pull/3',
                  title: 'fix(ui): fixed dark mode card details form',
                  state: 'closed',
                  merged: false,
                  draft: false,
                },
                {
                  id: '4',
                  url: 'https://github.com/org/repo/pull/4',
                  title: 'fix(ui): fixed dark mode card details form',
                  state: 'closed',
                  merged: true,
                  draft: false,
                },
              ],
            });
          }, 300);
        }
      );
      setGitActivities(response.activities);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
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
    } catch (error) {
      addErrorMessage(t('An error occurred while unlinkig the Pull Request'));
    }
  }

  if (isLoading) {
    return null;
  }

  return (
    <SidebarSection title={t('Git Activity')}>
      <IssueId>
        {t('Issue Id')}
        <IdAndCopyAction>
          <StyledShortId shortId={`#${shortId}`} />
          <CopyButton>
            <Clipboard value={shortId}>
              <Tooltip title={shortId} containerDisplayMode="flex">
                <StyledIconCopy />
              </Tooltip>
            </Clipboard>
          </CopyButton>
        </IdAndCopyAction>
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
    </SidebarSection>
  );
}

export default GitActivity;

const IssueId = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  display: grid;
  grid-gap: ${space(0.5)};
  margin-bottom: ${space(2)};
  font-weight: 700;
`;

const IdAndCopyAction = styled('div')`
  display: flex;
  align-items: center;
  font-weight: 400;
`;

const StyledShortId = styled(ShortId)`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.textColor};
  background: ${p => p.theme.backgroundSecondary};
  padding: ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  font-weight: 400;
  justify-content: flex-start;
  flex: 1;
`;

const CopyButton = styled('div')`
  padding: 0 ${space(0.5)} 0 ${space(1.5)};
`;

const StyledIconCopy = styled(IconCopy)`
  cursor: pointer;
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
