import styled from '@emotion/styled';

import {cancelDeleteRepository, hideRepository} from 'sentry/actionCreators/integrations';
import {Client} from 'sentry/api';
import Access from 'sentry/components/acl/access';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import ExternalLink from 'sentry/components/links/externalLink';
import PanelItem from 'sentry/components/panels/panelItem';
import {Tooltip} from 'sentry/components/tooltip';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Repository, RepositoryStatus} from 'sentry/types';

type Props = {
  api: Client;
  orgSlug: string;
  repository: Repository;
  onRepositoryChange?: (data: {id: string; status: RepositoryStatus}) => void;
  showProvider?: boolean;
};

function getStatusLabel(repo: Repository) {
  switch (repo.status) {
    case RepositoryStatus.PENDING_DELETION:
      return 'Deletion Queued';
    case RepositoryStatus.DELETION_IN_PROGRESS:
      return 'Deletion in Progress';
    case RepositoryStatus.DISABLED:
      return 'Disabled';
    case RepositoryStatus.HIDDEN:
      return 'Disabled';
    default:
      return null;
  }
}

function RepositoryRow({
  api,
  repository,
  onRepositoryChange,
  orgSlug,
  showProvider = false,
}: Props) {
  const isActive = repository.status === RepositoryStatus.ACTIVE;

  const cancelDelete = () =>
    cancelDeleteRepository(api, orgSlug, repository.id).then(
      data => {
        if (onRepositoryChange) {
          onRepositoryChange(data);
        }
      },
      () => {}
    );

  const deleteRepo = () =>
    hideRepository(api, orgSlug, repository.id).then(
      data => {
        if (onRepositoryChange) {
          onRepositoryChange(data);
        }
      },
      () => {}
    );

  const renderDeleteButton = (hasAccess: boolean) => (
    <Tooltip
      title={t(
        'You must be an organization owner, manager or admin to remove a repository.'
      )}
      disabled={hasAccess}
    >
      <Confirm
        disabled={
          !hasAccess || (!isActive && repository.status !== RepositoryStatus.DISABLED)
        }
        onConfirm={deleteRepo}
        message={t(
          'Are you sure you want to remove this repository? All associated commit data will be removed in addition to the repository.'
        )}
      >
        <StyledButton
          size="xs"
          icon={<IconDelete />}
          aria-label={t('delete')}
          disabled={!hasAccess}
        />
      </Confirm>
    </Tooltip>
  );

  return (
    <Access access={['org:integrations']}>
      {({hasAccess}) => (
        <StyledPanelItem status={repository.status}>
          <RepositoryTitleAndUrl>
            <RepositoryTitle>
              <strong>{repository.name}</strong>
              {!isActive && <small> &mdash; {getStatusLabel(repository)}</small>}
              {repository.status === RepositoryStatus.PENDING_DELETION && (
                <StyledButton
                  size="xs"
                  onClick={cancelDelete}
                  disabled={!hasAccess}
                  data-test-id="repo-cancel"
                >
                  {t('Cancel')}
                </StyledButton>
              )}
            </RepositoryTitle>
            <div>
              {showProvider && <small>{repository.provider.name}</small>}
              {showProvider && repository.url && <span>&nbsp;&mdash;&nbsp;</span>}
              {repository.url && (
                <small>
                  <ExternalLink href={repository.url}>
                    {repository.url.replace('https://', '')}
                  </ExternalLink>
                </small>
              )}
            </div>
          </RepositoryTitleAndUrl>
          {renderDeleteButton(hasAccess)}
        </StyledPanelItem>
      )}
    </Access>
  );
}

const StyledPanelItem = styled(PanelItem)<{status: RepositoryStatus}>`
  /* shorter top padding because of title lineheight */
  padding: ${space(1)} ${space(2)} ${space(2)};
  justify-content: space-between;
  align-items: center;
  flex: 1;

  ${p =>
    p.status === RepositoryStatus.DISABLED &&
    `
    filter: grayscale(1);
    opacity: 0.4;
  `};

  &:last-child {
    border-bottom: none;
  }
`;

const StyledButton = styled(Button)`
  margin-left: ${space(1)};
`;

const RepositoryTitleAndUrl = styled('div')`
  display: flex;
  flex-direction: column;
`;

const RepositoryTitle = styled('div')`
  /* accommodate cancel button height */
  line-height: 26px;
`;

export default RepositoryRow;
