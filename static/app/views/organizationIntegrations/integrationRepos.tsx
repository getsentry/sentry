import {Fragment} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {addRepository, migrateRepository} from 'sentry/actionCreators/integrations';
import RepositoryActions from 'sentry/actions/repositoryActions';
import Alert from 'sentry/components/alert';
import AsyncComponent from 'sentry/components/asyncComponent';
import Button from 'sentry/components/button';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import DropdownButton from 'sentry/components/dropdownButton';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import RepositoryRow from 'sentry/components/repositoryRow';
import {IconCommit} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Integration, Organization, Repository} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

type Props = AsyncComponent['props'] & {
  integration: Integration;
  organization: Organization;
};

type State = AsyncComponent['state'] & {
  adding: boolean;
  dropdownBusy: boolean;
  integrationRepos: {
    repos: {identifier: string; name: string}[];
    searchable: boolean;
  };
  itemList: Repository[];
};

class IntegrationRepos extends AsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      adding: false,
      itemList: [],
      integrationRepos: {repos: [], searchable: false},
      dropdownBusy: false,
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const orgId = this.props.organization.slug;
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
        // allow for custom scm repositories to be updated, and
        // url is optional and therefore can be an empty string
        item.url = data.url === undefined ? item.url : data.url;
        item.name = data.name || item.name;
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
    const orgId = this.props.organization.slug;
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

  addRepo(selection: {label: JSX.Element; searchKey: string; value: string}) {
    const {integration} = this.props;
    const {itemList} = this.state;
    const orgId = this.props.organization.slug;

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
    const access = new Set(this.props.organization.access);
    if (!access.has('org:integrations')) {
      return (
        <DropdownButton
          disabled
          title={t(
            'You must be an organization owner, manager or admin to add repositories'
          )}
          isOpen={false}
          size="xs"
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
          <DropdownButton isOpen={isOpen} size="xs" busy={this.state.adding}>
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
        <Alert type="error" showIcon>
          {t(
            'We were unable to fetch repositories for this integration. Try again later. If this error continues, please reconnect this integration by uninstalling and then reinstalling.'
          )}
        </Alert>
      );
    }

    return super.renderError(error);
  }

  renderBody() {
    const {itemListPageLinks} = this.state;
    const orgId = this.props.organization.slug;
    const itemList = this.getIntegrationRepos() || [];
    const header = (
      <PanelHeader disablePadding hasButtons>
        <HeaderText>{t('Repositories')}</HeaderText>
        <DropdownWrapper>{this.renderDropdown()}</DropdownWrapper>
      </PanelHeader>
    );

    return (
      <Fragment>
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
                  <Button href="https://docs.sentry.io/product/releases/">
                    {t('Learn More')}
                  </Button>
                }
              />
            )}
            {itemList.map(repo => (
              <RepositoryRow
                api={this.api}
                key={repo.id}
                repository={repo}
                orgId={orgId}
                onRepositoryChange={this.onRepositoryChange}
              />
            ))}
          </PanelBody>
        </Panel>
        {itemListPageLinks && (
          <Pagination pageLinks={itemListPageLinks} {...this.props} />
        )}
      </Fragment>
    );
  }
}

export default withOrganization(IntegrationRepos);

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
  ${p => p.theme.overflowEllipsis};
`;
