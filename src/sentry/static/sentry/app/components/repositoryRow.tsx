import React from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {PanelItem} from 'app/components/panels';
import {Repository, RepositoryStatus} from 'app/types';
import {deleteRepository, cancelDeleteRepository} from 'app/actionCreators/integrations';
import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {IconDelete} from 'app/icons';
import space from 'app/styles/space';
import Tooltip from 'app/components/tooltip';

type DefaultProps = {
  showProvider?: boolean;
};

type Props = DefaultProps & {
  repository: Repository;
  api: Client;
  orgId: string;
  onRepositoryChange?: (data: {id: string; status: RepositoryStatus}) => void;
};

class RepositoryRow extends React.Component<Props> {
  static defaultProps: DefaultProps = {
    showProvider: false,
  };

  getStatusLabel(repo: Repository) {
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

  cancelDelete = () => {
    const {api, orgId, repository, onRepositoryChange} = this.props;
    cancelDeleteRepository(api, orgId, repository.id).then(
      data => {
        if (onRepositoryChange) {
          onRepositoryChange(data);
        }
      },
      () => {}
    );
  };

  deleteRepo = () => {
    const {api, orgId, repository, onRepositoryChange} = this.props;
    deleteRepository(api, orgId, repository.id).then(
      data => {
        if (onRepositoryChange) {
          onRepositoryChange(data);
        }
      },
      () => {}
    );
  };

  get isActive() {
    return this.props.repository.status === RepositoryStatus.ACTIVE;
  }

  render() {
    const {repository, showProvider} = this.props;
    const isActive = this.isActive;

    return (
      <Access access={['org:integrations']}>
        {({hasAccess}) => (
          <StyledPanelItem status={repository.status}>
            <RepositoryTitleAndUrl>
              <RepositoryTitle>
                <strong>{repository.name}</strong>
                {!isActive && <small> &mdash; {this.getStatusLabel(repository)}</small>}
                {repository.status === RepositoryStatus.PENDING_DELETION && (
                  <StyledButton
                    size="xsmall"
                    onClick={this.cancelDelete}
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
                    <a href={repository.url}>{repository.url.replace('https://', '')}</a>
                  </small>
                )}
              </div>
            </RepositoryTitleAndUrl>

            <Tooltip
              title={t(
                'You must be an organization owner, manager or admin to remove a repository.'
              )}
              disabled={hasAccess}
            >
              <Confirm
                disabled={
                  !hasAccess ||
                  (!isActive && repository.status !== RepositoryStatus.DISABLED)
                }
                onConfirm={this.deleteRepo}
                message={t(
                  'Are you sure you want to remove this repository? All associated commit data will be removed in addition to the repository.'
                )}
              >
                <Button
                  size="xsmall"
                  icon={<IconDelete size="xs" />}
                  label={t('delete')}
                  disabled={!hasAccess}
                />
              </Confirm>
            </Tooltip>
          </StyledPanelItem>
        )}
      </Access>
    );
  }
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
  margin-bottom: ${space(1)};
  /* accommodate cancel button height */
  line-height: 26px;
`;

export default RepositoryRow;
