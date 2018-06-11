import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t, tct} from 'app/locale';
import {addSuccessMessage, addErrorMessage} from 'app/actionCreators/indicator';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/buttons/button';
import Confirm from 'app/components/confirm';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import IndicatorStore from 'app/stores/indicatorStore';
import SpreadLayout from 'app/components/spreadLayout';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';

export default class IntegrationRepos extends AsyncComponent {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    integration: PropTypes.object.isRequired,
  };
  static contextTypes = {
    organization: PropTypes.object.isRequired,
  };

  constructor(props, context) {
    super(props, context);
    Object.assign(this.state, {
      ...this.getDefaultState(),
      loading: true,
    });
  }

  getDefaultState() {
    return {
      error: false,
      itemList: null,
      errors: {},
    };
  }

  getEndpoints() {
    return [
      ['itemList', `/organizations/${this.props.orgId}/repos/`, {query: {status: ''}}],
      ['integrationRepos', `/organizations/${this.props.orgId}/integrations/${this.props.integration.id}/repos/`]
    ];
  }

  getIntegrationRepos() {
    let provider = `integrations:${this.props.integration.provider.key}`;
    return this.state.itemList.filter(repo => repo.provider.id == provider);
  }

  getStatusLabel(repo) {
    switch (repo.status) {
      case 'pending_deletion':
        return 'Deletion Queued';
      case 'deletion_in_progress':
        return 'Deletion in Progress';
      case 'hidden':
        return 'Disabled';
      default:
        return null;
    }
  }

  addRepo(selection) {
    let {integration, orgId} = this.props;
    let {itemList} = this.state;
    this.setState({loading: true});
    this.api.request(`/organizations/${orgId}/repos/`, {
      data: {
        installation: integration.id,
        name: selection.value,
        provider: `integrations:${integration.provider.key}`,
      },
      method: 'POST',
      success: repo => {
        this.setState({loading: false, itemList: itemList.concat(repo)});
        addSuccessMessage(
          tct('[repo] has been successfully added.', {
            repo: repo.name,
          })
        );
      },
      error: data => {
        this.setState({loading: false});
        addErrorMessage(t('Unable to add repository.'));
      },
    });
  }

  deleteRepo = repo => {
    let indicator = IndicatorStore.add(t('Saving changes..'));
    this.api.request(`/organizations/${this.props.orgId}/repos/${repo.id}/`, {
      method: 'DELETE',
      success: data => {
        let itemList = this.state.itemList;
        itemList.forEach(item => {
          if (item.id === data.id) {
            item.status = data.status;
          }
        });
        this.setState({itemList});
      },
      error: () => {
        addErrorMessage(t('Unable to delete repository.'));
      },
      complete: () => {
        IndicatorStore.remove(indicator);
      },
    });
  };

  cancelDelete = repo => {
    let {orgId} = this.props;
    let indicator = IndicatorStore.add(t('Saving changes..'));
    this.api.request(`/organizations/${orgId}/repos/${repo.id}/`, {
      method: 'PUT',
      data: {status: 'visible'},
      success: data => {
        let itemList = this.state.itemList;
        itemList.forEach(item => {
          if (item.id === data.id) {
            item.status = data.status;
          }
        });
        this.setState({itemList});
      },
      error: () => {
        addErrorMessage(t('An error occurred.'));
      },
      complete: () => {
        IndicatorStore.remove(indicator);
      },
    });
  };

  renderDropdown() {
    let access = new Set(this.context.organization.access);
    if (!access.has('org:write')) {
      return (
        <DropdownButton
          disabled={true}
          title={t('You do not have permission to add repos')}
          isOpen={false}
          size="xsmall"
        >
          {t('Add Repo')}
        </DropdownButton>
      );
    }
    let repositories = this.state.integrationRepos.repos;
    let items = (repositories || []).map(repo => {
      return {
        searchKey: `${repo.name}`,
        value: `${repo.full_name}`,
        label: (
          <StyledListElement>
            <StyledName>{repo.name}</StyledName>
          </StyledListElement>
        ),
      };
    });

    let menuHeader = <StyledReposLabel>{t('Repositories')}</StyledReposLabel>;

    return (
      <DropdownAutoComplete
        items={items}
        onSelect={this.addRepo.bind(this)}
        menuHeader={menuHeader}
        emptyMessage={t('No repositories available')}
      >
        {({isOpen}) => (
          <DropdownButton isOpen={isOpen} size="xsmall">
            {t('Add Repo')}
          </DropdownButton>
        )}
      </DropdownAutoComplete>
    );
  }

  renderBody() {
    const itemList = this.getIntegrationRepos() || [];
    const header = (
      <PanelHeader hasButtons>
        <div>{t('Repositories')}</div>
        <div style={{textTransform: 'none'}}>{this.renderDropdown()}</div>
      </PanelHeader>
    );

    return (
      <React.Fragment>
        <Panel>
          {header}
          <PanelBody>
            {itemList.length === 0 && (
              <Box>
                <EmptyMessage size="large">{t('No Repositories Added')}</EmptyMessage>
              </Box>
            )}
            {itemList.length > 0 && (
              <Box>
                {itemList.map(repo => {
                  let repoIsVisible = repo.status === 'active';
                  return (
                    <RepoOption key={repo.id}>
                      <Box p={2} flex="1">
                        <Flex direction="column">
                          <Box pb={1}>
                            <strong>{repo.name}</strong>
                            {!repoIsVisible && (
                              <small> — {this.getStatusLabel(repo)}</small>
                            )}
                            {repo.status === 'pending_deletion' && (
                              <small>
                                {' '}
                                (
                                <a onClick={() => this.cancelDelete(repo)}>
                                  {t('Cancel')}
                                </a>
                                )
                              </small>
                            )}
                          </Box>
                          <Box>
                            <small>{repo.provider.name}</small>
                            {repo.url && (
                              <small>
                                {' '}
                                — <a href={repo.url}>{repo.url}</a>
                              </small>
                            )}
                          </Box>
                        </Flex>
                      </Box>

                      <Box p={2}>
                        <Confirm
                          disabled={!repoIsVisible}
                          onConfirm={() => this.deleteRepo(repo)}
                          message={t('Are you sure you want to remove this repository?')}
                        >
                          <Button size="xsmall">
                            <span className="icon icon-trash" />
                          </Button>
                        </Confirm>
                      </Box>
                    </RepoOption>
                  );
                })}
              </Box>
            )}
          </PanelBody>
        </Panel>
      </React.Fragment>
    );
  }
}

const StyledReposLabel = styled('div')`
  width: 250px;
  font-size: 0.875em;
  padding: ${space(1)} 0;
  text-transform: uppercase;
`;

const StyledListElement = styled('div')`
  font-size: 0.875em;
  display: flex;
  align-items: center;
  padding: ${space(0.5)};
`;

const StyledName = styled('div')`
  flex-shrink: 1;
  min-width: 0;
  ${overflowEllipsis};
`;

const RepoOption = styled(SpreadLayout)`
  border-bottom: 1px solid ${p => p.theme.borderLight};

  &:last-child {
    border-bottom: none;
  }
`;
