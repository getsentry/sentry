import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import {debounce} from 'lodash';
import React from 'react';
import styled from 'react-emotion';

import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import IndicatorStore from 'app/stores/indicatorStore';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import Pagination from 'app/components/pagination';
import RepositoryRow from 'app/components/repositoryRow';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
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
    this.state = {
      error: false,
      adding: false,
      itemList: [],
      dropdownBusy: false,
      errors: {},
    };
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
    let integrationId = this.props.integration.id;
    return this.state.itemList.filter(repo => repo.integrationId === integrationId);
  }

  // Called by row to signal repository change.
  onRepositoryChange = data => {
    let itemList = this.state.itemList;
    itemList.forEach(item => {
      if (item.id === data.id) {
        item.status = data.status;
      }
    });
    this.setState({itemList});
  };

  debouncedSearchRepositoriesRequest = debounce(
    query => this.searchRepositoriesRequest(query),
    200
  );

  searchRepositoriesRequest = searchQuery => {
    let orgId = this.context.organization.slug;
    let query = {search: searchQuery};
    let endpoint = `/organizations/${orgId}/integrations/${this.props.integration
      .id}/repos/`;
    return this.api.request(endpoint, {
      method: 'GET',
      query,
      success: data => {
        this.setState({integrationRepos: data, dropdownBusy: false});
      },
      error: error => {
        this.setState({dropdownBusy: false});
      },
    });
  };

  handleSearchRepositories = e => {
    this.setState({dropdownBusy: true});
    this.debouncedSearchRepositoriesRequest(e.target.value);
  };

  addRepo(selection) {
    let {integration} = this.props;
    let orgId = this.context.organization.slug;
    let {itemList} = this.state;
    let migratableRepo = itemList.filter(item => selection.value === item.name)[0];
    let path = migratableRepo
      ? `/organizations/${orgId}/repos/${migratableRepo.id}/`
      : `/organizations/${orgId}/repos/`;
    let data = migratableRepo
      ? {integrationId: integration.id}
      : {
          installation: integration.id,
          identifier: selection.value,
          provider: `integrations:${integration.provider.key}`,
        };
    let method = migratableRepo ? 'PUT' : 'POST';
    let saveIndicator = IndicatorStore.add(t('Adding repository...'));
    this.setState({adding: true});
    this.api.request(path, {
      data,
      method,
      success: repo => {
        this.setState({itemList: itemList.concat(repo)});
        IndicatorStore.addSuccess(
          tct('[repo] has been successfully added.', {
            repo: repo.name,
          })
        );
      },
      error: errorData => {
        let text = errorData.responseJSON.errors
          ? errorData.responseJSON.errors.__all__
          : t('Unable to add repository.');
        IndicatorStore.addError(text);
      },
      complete: () => {
        IndicatorStore.remove(saveIndicator);
        this.setState({adding: false});
      },
    });
  }

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
    const repositories = new Set(
      this.state.itemList.filter(item => item.integrationId).map(i => i.name)
    );
    let repositoryOptions = (this.state.integrationRepos.repos || []).filter(
      repo => !repositories.has(repo.identifier)
    );
    let items = repositoryOptions.map(repo => {
      return {
        searchKey: repo.name,
        value: repo.identifier,
        label: (
          <StyledListElement>
            <StyledName>{repo.name}</StyledName>
          </StyledListElement>
        ),
      };
    });

    let menuHeader = <StyledReposLabel>{t('Repositories')}</StyledReposLabel>;
    let onChange = this.state.integrationRepos.searchable
      ? this.handleSearchRepositories
      : null;

    return (
      <DropdownAutoComplete
        items={items}
        onSelect={this.addRepo.bind(this)}
        onChange={onChange}
        menuHeader={menuHeader}
        emptyMessage={t('No repositories available')}
        noResultsMessage={t('No repositories found')}
        busy={this.state.dropdownBusy}
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
    const {itemListPageLinks} = this.state;
    const orgId = this.context.organization.slug;
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
      <React.Fragment>
        <Panel>
          {header}
          <PanelBody>
            {itemList.length === 0 && (
              <EmptyMessage
                icon="icon-commit"
                title={t('Sentry is better with commit data')}
                description={t(
                  'Add a repository to begin tracking its commit data. Then, set up release tracking to unlock features like suspect commits, suggested owners, and deploy emails.'
                )}
                action={
                  <Button href="https://docs.sentry.io/learn/releases/">
                    {t('Learn More')}
                  </Button>
                }
              />
            )}
            {itemList.map(repo => {
              return (
                <RepositoryRow
                  key={repo.id}
                  repository={repo}
                  orgId={orgId}
                  api={this.api}
                  onRepositoryChange={this.onRepositoryChange}
                />
              );
            })}
          </PanelBody>
        </Panel>
        {itemListPageLinks && (
          <Pagination pageLinks={itemListPageLinks} {...this.props} />
        )}
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
  display: flex;
  align-items: center;
  padding: ${space(0.5)};
`;

const StyledName = styled('div')`
  flex-shrink: 1;
  min-width: 0;
  ${overflowEllipsis};
`;
