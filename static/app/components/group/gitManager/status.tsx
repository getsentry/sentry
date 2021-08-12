import Tooltip from 'app/components/tooltip';
import {IconGitBranch} from 'app/icons/IconGitBranch';
import {IconGitPullRequestClosed} from 'app/icons/IconGitPullRequestClosed';
import {IconGitPullRequestDraft} from 'app/icons/iconGitPullRequestDraft';
import {IconGitPullRequestMerged} from 'app/icons/IconGitPullRequestMerged';
import {IconGitPullRequestOpen} from 'app/icons/iconGitPullRequestOpen';
import {t} from 'app/locale';

type Props = {
  state: 'open' | 'closed' | 'merged' | 'draft' | 'created' | 'deleted';
};

function Status({state}: Props) {
  if (state === 'draft') {
    return (
      <Tooltip title={t('Pull Request open - draft')}>
        <IconGitPullRequestDraft color="gray300" size="md" />
      </Tooltip>
    );
  }

  if (state === 'open') {
    return (
      <Tooltip title={t('Pull Request open')}>
        <IconGitPullRequestOpen color="green300" size="md" />
      </Tooltip>
    );
  }

  if (state === 'merged') {
    return (
      <Tooltip title={t('Pull Request merged')}>
        <IconGitPullRequestMerged color="purple300" size="md" />
      </Tooltip>
    );
  }

  if (state === 'created') {
    return (
      <Tooltip title={t('Branch created')}>
        <IconGitBranch color="gray400" size="md" />
      </Tooltip>
    );
  }

  if (state === 'deleted') {
    return (
      <Tooltip title={t('Branch deleted')}>
        <IconGitBranch color="gray400" size="md" />
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
