import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Repository} from 'app/sentryTypes';
import {deleteRepository, cancelDeleteRepository} from 'app/actionCreators/integrations';
import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import SpreadLayout from 'app/components/spreadLayout';
import space from 'app/styles/space';

class RepositoryRow extends React.Component {
  static propTypes = {
    repository: Repository,
    api: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    showProvider: PropTypes.bool,
    onRepositoryChange: PropTypes.func,
  };

  static defaultProps = {
    showProvider: false,
  };

  getStatusLabel(repo) {
    switch (repo.status) {
      case 'pending_deletion':
        return 'Deletion Queued';
      case 'deletion_in_progress':
        return 'Deletion in Progress';
      case 'disabled':
        return 'Disabled';
      case 'hidden':
        return 'Disabled';
      default:
        return null;
    }
  }

  cancelDelete = () => {
    let {api, orgId, repository, onRepositoryChange} = this.props;
    cancelDeleteRepository(api, orgId, repository.id).then(
      data => {
        if (onRepositoryChange) onRepositoryChange(data);
      },
      () => {}
    );
  };

  deleteRepo = () => {
    let {api, orgId, repository, onRepositoryChange} = this.props;
    deleteRepository(api, orgId, repository.id).then(
      data => {
        if (onRepositoryChange) onRepositoryChange(data);
      },
      () => {}
    );
  };

  get isActive() {
    return this.props.repository.status === 'active';
  }

  render() {
    let {repository, showProvider} = this.props;
    let isActive = this.isActive;

    return (
      <Access access={['org:admin']}>
        {({hasAccess}) => (
          <StyledRow status={repository.status}>
            <Flex direction="column">
              <RepositoryTitle>
                <strong>{repository.name}</strong>
                {!isActive && <small> &mdash; {this.getStatusLabel(repository)}</small>}
                {repository.status === 'pending_deletion' && (
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
              <Box>
                {showProvider && <small>{repository.provider.name}</small>}
                {showProvider && repository.url && <span>&nbsp;&mdash;&nbsp;</span>}
                {repository.url && (
                  <small>
                    <a href={repository.url}>{repository.url.replace('https://', '')}</a>
                  </small>
                )}
              </Box>
            </Flex>

            <Confirm
              disabled={!hasAccess || (!isActive && repository.status !== 'disabled')}
              onConfirm={this.deleteRepo}
              message={t('Are you sure you want to remove this repository?')}
            >
              <Button size="xsmall" icon="icon-trash" disabled={!hasAccess} />
            </Confirm>
          </StyledRow>
        )}
      </Access>
    );
  }
}

const StyledRow = styled(SpreadLayout)`
  border-bottom: 1px solid ${p => p.theme.borderLight};
  /* shorter top padding because of title lineheight */
  padding: ${space(1)} ${space(2)} ${space(2)};
  flex: 1;
  align-items: space-between;

  ${p =>
    p.status === 'disabled' &&
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

const RepositoryTitle = styled(Box)`
  margin-bottom: ${space(1)};
  /* accomodate cancel button height */
  line-height: 26px;
`;

export default RepositoryRow;
