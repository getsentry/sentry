import PropTypes from 'prop-types';
import debounce from 'lodash/debounce';
import * as React from 'react';
import styled from '@emotion/styled';

import {migrateRepository, addRepository} from 'app/actionCreators/integrations';
import RepositoryActions from 'app/actions/repositoryActions';
import Alert from 'app/components/alert';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import {IconCommit, IconFlag} from 'app/icons';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import Pagination from 'app/components/pagination';
import RepositoryRow from 'app/components/repositoryRow';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import space from 'app/styles/space';
import {t} from 'app/locale';
import {Integration, Repository} from 'app/types';

type Props = AsyncComponent['props'] & {
  integration: Integration;
};

type State = AsyncComponent['state'] & {
  adding: boolean;
  dropdownBusy: boolean;
  itemList: Repository[];
  integrationRepos: {
    repos: {identifier: string; name: string}[];
    searchable: boolean;
  };
};

export default class IntegrationRepos extends AsyncComponent<Props, State> {
  static propTypes = {
    integration: PropTypes.object.isRequired,
  };
  static contextTypes = {
    organization: PropTypes.object.isRequired,
    router: PropTypes.object,
  };

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      adding: false,
      itemList: [],
      integrationRepos: {repos: [], searchable: false},
      dropdownBusy: false,
    };
  }

  getEndpoints(): ([string, string, any] | [string, string])[] {
    const orgId = this.context.organization.slug;
    return [
      ['itemList', `/organizations/${orgId}/repos/`, {query: {status: ''}}],
      [
        'integrationRepos',
        `/organizations/${orgId}/integrations/${this.props.integration.id}/repos/`,
      ],
    ];
  }

  getIntegrationRepos() {
    const integrationId = this.props.integration.id;
    return this.state.itemList.filter(repo => repo.integrationId === integrationId);
  }

  // Called by row to signal repository change.
  onRepositoryChange = data => {
    const itemList = this.state.itemList;
    itemList.forEach(item => {
      if (item.id === data.id) {
        item.status = data.status;
      }
    });
    this.setState({itemList});
    RepositoryActions.resetRepositories();
  };

  debouncedSearchRepositoriesRequest = debounce(
    query => this.searchRepositoriesRequest(query),
    200
  );

  searchRepositoriesRequest = (searchQuery: string) => {
    const orgId = this.context.organization.slug;
    const query = {search: searchQuery};
    const endpoint = `/organizations/${orgId}/integrations/${this.props.integration.id}/repos/`;
    return this.api.request(endpoint, {
      method: 'GET',
      query,
      success: data => {
        this.setState({integrationRepos: data, dropdownBusy: false});
      },
      error: () => {
        this.setState({dropdownBusy: false});
      },
    });
  };

  handleSearchRepositories = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({dropdownBusy: true});
    this.debouncedSearchRepositoriesRequest(e.target.value);
  };

  addRepo(selection: {searchKey: string; value: string; label: JSX.Element}) {
    const {integration} = this.props;
    const {itemList} = this.state;
    const orgId = this.context.organization.slug;

    this.setState({adding: true});

    const migratableRepo = itemList.filter(item => {
      if (!(selection.value && item.externalSlug)) {
        return false;
      }
      return selection.value === item.externalSlug;
    })[0];

    let promise;
    if (migratableRepo) {
      promise = migrateRepository(this.api, orgId, migratableRepo.id, integration);
    } else {
      promise = addRepository(this.api, orgId, selection.value, integration);
    }
    promise.then(
      (repo: Repository) => {
        this.setState({adding: false, itemList: itemList.concat(repo)});
        RepositoryActions.resetRepositories();
      },
      () => this.setState({adding: false})
    );
  }

  renderDropdown() {
    const access = new Set(this.context.organization.access);
    if (!access.has('org:integrations')) {
      return (
        <DropdownButton
          disabled
          title={t(
            'You must be an organization owner, manager or admin to add repositories'
          )}
          isOpen={false}
          size="xsmall"
        >
          {t('Add Repository')}
        </DropdownButton>
      );
    }
    const repositories = new Set(
      this.state.itemList.filter(item => item.integrationId).map(i => i.externalSlug)
    );
    const repositoryOptions = (this.state.integrationRepos.repos || []).filter(
      repo => !repositories.has(repo.identifier)
    );
    const items = repositoryOptions.map(repo => ({
      searchKey: repo.name,
      value: repo.identifier,
      label: (
        <StyledListElement>
          <StyledName>{repo.name}</StyledName>
        </StyledListElement>
      ),
    }));

    const menuHeader = <StyledReposLabel>{t('Repositories')}</StyledReposLabel>;
    const onChange = this.state.integrationRepos.searchable
      ? this.handleSearchRepositories
      : undefined;

    return (
      <DropdownAutoComplete
        items={items}
        onSelect={this.addRepo.bind(this)}
        onChange={onChange}
        menuHeader={menuHeader}
        emptyMessage={t('No repositories available')}
        noResultsMessage={t('No repositories found')}
        busy={this.state.dropdownBusy}
        alignMenu="right"
      >
        {({isOpen}) => (
          <DropdownButton isOpen={isOpen} size="xsmall" busy={this.state.adding}>
            {t('Add Repository')}
          </DropdownButton>
        )}
      </DropdownAutoComplete>
    );
  }

  renderError(error) {
    const badRequest = Object.values(this.state.errors).find(
      resp => resp && resp.status === 400
    );
    if (badRequest) {
      return (
        <Alert type="error" icon={<IconFlag size="md" />}>
          {t(
            'We were unable to fetch repositories for this integration. Try again later, or reconnect this integration.'
          )}
        </Alert>
      );
    }

    return super.renderError(error);
  }

  renderBody() {
    const {itemListPageLinks} = this.state;
    const orgId = this.context.organization.slug;
    const itemList = this.getIntegrationRepos() || [];
    const header = (
      <PanelHeader disablePadding hasButtons>
        <HeaderText>{t('Repositories')}</HeaderText>
        <DropdownWrapper>{this.renderDropdown()}</DropdownWrapper>
      </PanelHeader>
    );

    return (
      <React.Fragment>
        <Panel>
          {header}
          <PanelBody>
            {itemList.length === 0 && (
              <EmptyMessage
                icon={<IconCommit />}
                title={t('Sentry is better with commit data')}
                description={t(
                  'Add a repository to begin tracking its commit data. Then, set up release tracking to unlock features like suspect commits, suggested issue owners, and deploy emails.'
                )}
                action={
                  <Button href="https://docs.sentry.io/learn/releases/">
                    {t('Learn More')}
                  </Button>
                }
              />
            )}
            {itemList.map(repo => (
              <RepositoryRow
                key={repo.id}
                repository={repo}
                orgId={orgId}
                api={this.api}
                onRepositoryChange={this.onRepositoryChange}
              />
            ))}
          </PanelBody>
        </Panel>
        {itemListPageLinks && (
          <Pagination pageLinks={itemListPageLinks} {...this.props} />
        )}
      </React.Fragment>
    );
  }
}

const HeaderText = styled('div')`
  padding-left: ${space(2)};
  flex: 1;
`;

const DropdownWrapper = styled('div')`
  padding-right: ${space(1)};
  text-transform: none;
`;

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
