import {Box, Flex} from 'grid-emotion';
import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';

import {deleteRepository, cancelDeleteRepository} from 'app/actionCreators/integrations';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import SpreadLayout from 'app/components/spreadLayout';
import {Repository} from 'app/sentryTypes';
import {t} from 'app/locale';

const StyledRow = styled(SpreadLayout)`
  border-bottom: 1px solid ${p => p.theme.borderLight};

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
      <StyledRow status={repository.status}>
        <Box p={2} flex="1">
          <Flex direction="column">
            <Box pb={1}>
              <strong>{repository.name}</strong>
              {!isActive && <small> — {this.getStatusLabel(repository)}</small>}
              {repository.status === 'pending_deletion' && (
                <small>
                  {' '}
                  (
                  <a onClick={this.cancelDelete}>{t('Cancel')}</a>
                  )
                </small>
              )}
            </Box>
            <Box>
              {showProvider && (
                <small>{repository.provider.name}&nbsp;&mdash;&nbsp;</small>
              )}
              {repository.url && (
                <small>
                  <a href={repository.url}>{repository.url.replace('https://', '')}</a>
                </small>
              )}
            </Box>
          </Flex>
        </Box>

        <Box p={2}>
          <Confirm
            disabled={!isActive && repository.status !== 'disabled'}
            onConfirm={this.deleteRepo}
            message={t('Are you sure you want to remove this repository?')}
          >
            <Button size="xsmall" icon="icon-trash" />
          </Confirm>
        </Box>
      </StyledRow>
    );
  }
}

export default RepositoryRow;
