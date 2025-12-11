import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {cancelDeleteRepository, hideRepository} from 'sentry/actionCreators/integrations';
import Access from 'sentry/components/acl/access';
import Confirm from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import PanelItem from 'sentry/components/panels/panelItem';
import getRepoStatusLabel from 'sentry/components/repositories/getRepoStatusLabel';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Repository} from 'sentry/types/integrations';
import {RepositoryStatus} from 'sentry/types/integrations';
import useApi from 'sentry/utils/useApi';

type Props = {
  orgSlug: string;
  repository: Repository;
  onRepositoryChange?: (data: Repository) => void;
  showProvider?: boolean;
};

export default function RepositoryRow({
  repository,
  onRepositoryChange,
  orgSlug,
  showProvider = false,
}: Props) {
  const isActive = repository.status === RepositoryStatus.ACTIVE;
  const api = useApi();

  const cancelDelete = () =>
    cancelDeleteRepository(api, orgSlug, repository.id).then(
      data => {
        onRepositoryChange?.(data);
      },
      () => {}
    );

  const deleteRepo = () =>
    hideRepository(api, orgSlug, repository.id).then(
      data => {
        onRepositoryChange?.(data);
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
              {!isActive && <small> &mdash; {getRepoStatusLabel(repository)}</small>}
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
    css`
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
