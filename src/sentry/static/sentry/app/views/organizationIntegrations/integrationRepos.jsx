import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/buttons/button';
import Confirm from 'app/components/confirm';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import IndicatorStore from 'app/stores/indicatorStore';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import SpreadLayout from 'app/components/spreadLayout';
import space from 'app/styles/space';
import {t, tct} from 'app/locale';

export default class IntegrationRepos extends AsyncComponent {
  static propTypes = {
    integration: PropTypes.object.isRequired,
  };
  static contextTypes = {
    organization: PropTypes.object.isRequired,
  };

  constructor(props, context) {
    super(props, context);
    this.state = {error: false, adding: false, itemList: [], errors: {}};
  }

  getEndpoints() {
    let orgId = this.context.organization.slug;

    return [
      ['itemList', `/organizations/${orgId}/repos/`, {query: {status: ''}}],
      [
        'integrationRepos',
        `/organizations/${orgId}/integrations/${this.props.integration.id}/repos/`,
      ],
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
      case 'disabled':
        return 'Disabled';
      case 'hidden':
        return 'Disabled';
      default:
        return null;
    }
  }

  addRepo(selection) {
    let {integration} = this.props;
    let orgId = this.context.organization.slug;
    let {itemList} = this.state;
    let saveIndicator = IndicatorStore.add(t('Adding repository...'));
    this.setState({adding: true});

    this.api.request(`/organizations/${orgId}/repos/`, {
      data: {
        installation: integration.id,
        name: selection.value,
        provider: `integrations:${integration.provider.key}`,
      },
      method: 'POST',
      success: repo => {
        this.setState({itemList: itemList.concat(repo)});
        IndicatorStore.addSuccess(
          tct('[repo] has been successfully added.', {
            repo: repo.name,
          })
        );
      },
      error: () => IndicatorStore.addError(t('Unable to add repository.')),
      complete: () => {
        IndicatorStore.remove(saveIndicator);
        this.setState({adding: false});
      },
    });
  }

  deleteRepo = repo => {
    let orgId = this.context.organization.slug;
    let indicator = IndicatorStore.add(t('Saving changes..'));
    this.api.request(`/organizations/${orgId}/repos/${repo.id}/`, {
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
      error: () => IndicatorStore.addError(t('Unable to delete repository.')),
      complete: () => IndicatorStore.remove(indicator),
    });
  };

  cancelDelete = repo => {
    let orgId = this.context.organization.slug;
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
      error: () => IndicatorStore.addError(t('An error occurred.')),
      complete: () => IndicatorStore.remove(indicator),
    });
  };

  renderDropdown() {
    let access = new Set(this.context.organization.access);
    if (!access.has('org:write')) {
      return (
        <DropdownButton
          disabled={true}
          title={t('You do not have permission to add repositories')}
          isOpen={false}
          size="xsmall"
        >
          {t('Add Repository')}
        </DropdownButton>
      );
    }
    let repositories = this.state.integrationRepos.repos;
    let items = (repositories || []).map(repo => {
      return {
        searchKey: `${repo.name}`,
        value: `${repo.identifier}`,
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
          <DropdownButton isOpen={isOpen} size="xsmall" busy={this.state.adding}>
            {t('Add Repository')}
          </DropdownButton>
        )}
      </DropdownAutoComplete>
    );
  }

  renderBody() {
    const itemList = this.getIntegrationRepos() || [];
    const header = (
      <PanelHeader disablePadding hasButtons>
        <Box flex={1} pl={2}>
          {t('Repositories')}
        </Box>
        <Box pr={1} style={{textTransform: 'none'}}>
          {this.renderDropdown()}
        </Box>
      </PanelHeader>
    );

    return (
      <Panel>
        {header}
        <PanelBody>
          {itemList.length === 0 && (
            <EmptyMessage size="large">{t('No Repositories Added')}</EmptyMessage>
          )}
          {itemList.map(repo => {
            let repoIsActive = repo.status === 'active';
            return (
              <RepoOption key={repo.id} disabled={repo.status === 'disabled'}>
                <Box p={2} flex="1">
                  <Flex direction="column">
                    <Box pb={1}>
                      <strong>{repo.name}</strong>
                      {!repoIsActive && <small> — {this.getStatusLabel(repo)}</small>}
                      {repo.status === 'pending_deletion' && (
                        <small>
                          {' '}
                          (
                          <a onClick={() => this.cancelDelete(repo)}>{t('Cancel')}</a>
                          )
                        </small>
                      )}
                    </Box>
                    <Box>
                      <small>
                        <a href={repo.url}>{repo.url.replace('https://', '')}</a>
                      </small>
                    </Box>
                  </Flex>
                </Box>

                <Box p={2}>
                  <Confirm
                    disabled={!repoIsActive && repo.status !== 'disabled'}
                    onConfirm={() => this.deleteRepo(repo)}
                    message={t('Are you sure you want to remove this repository?')}
                  >
                    <Button size="xsmall" icon="icon-trash" />
                  </Confirm>
                </Box>
              </RepoOption>
            );
          })}
        </PanelBody>
      </Panel>
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

  ${p =>
    p.disabled &&
    `
    filter: grayscale(1);
    opacity: 0.4;
  `};
`;
