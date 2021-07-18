import Tooltip from 'app/components/tooltip';
import {IconGitPullRequestClosed} from 'app/icons/IconGitPullRequestClosed';
import {IconGitPullRequestDraft} from 'app/icons/iconGitPullRequestDraft';
import {IconGitPullRequestMerged} from 'app/icons/IconGitPullRequestMerged';
import {IconGitPullRequestOpen} from 'app/icons/iconGitPullRequestOpen';
import {t} from 'app/locale';

type Props = {
  // State of the Pull Request. Either open or closed
  state: 'open' | 'closed';
  merged: boolean;
  draft: boolean;
};

function Status({state, merged, draft}: Props) {
  if (state === 'open') {
    if (draft) {
      return (
        <Tooltip title={t('Pull Request open - draft')}>
          <IconGitPullRequestDraft color="gray300" size="md" />
        </Tooltip>
      );
    }

    return (
      <Tooltip title={t('Pull Request open')}>
        <IconGitPullRequestOpen color="green300" size="md" />
      </Tooltip>
    );
  }

  if (merged) {
    return (
      <Tooltip title={t('Pull Request merged')}>
        <IconGitPullRequestMerged color="purple300" size="md" />
      </Tooltip>
    );
  }

  return (
    <Tooltip title={t('Pull Request closed')}>
      <IconGitPullRequestClosed color="red300" size="md" />
    </Tooltip>
  );
}

export default Status;
