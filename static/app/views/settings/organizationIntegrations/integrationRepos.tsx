import {Fragment} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {addRepository, migrateRepository} from 'sentry/actionCreators/integrations';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import DropdownButton from 'sentry/components/dropdownButton';
import EmptyMessage from 'sentry/components/emptyMessage';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import RepositoryRow from 'sentry/components/repositoryRow';
import {IconCommit} from 'sentry/icons';
import {t} from 'sentry/locale';
import RepositoryStore from 'sentry/stores/repositoryStore';
import {space} from 'sentry/styles/space';
import type {
  Integration,
  IntegrationRepository,
  Organization,
  Repository,
} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type Props = DeprecatedAsyncComponent['props'] & {
  integration: Integration;
  organization: Organization;
};

type State = DeprecatedAsyncComponent['state'] & {
  adding: boolean;
  dropdownBusy: boolean;
  integrationRepos: {
    repos: IntegrationRepository[];
    searchable: boolean;
  };
  integrationReposErrorStatus: number | null;
  itemList: Repository[];
};

class IntegrationRepos extends DeprecatedAsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      adding: false,
      itemList: [],
      integrationRepos: {repos: [], searchable: false},
      integrationReposErrorStatus: null,
      dropdownBusy: true,
    };
  }

  componentDidMount() {
    super.componentDidMount();
    this.searchRepositoriesRequest();
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization, integration} = this.props;
    return [
      [
        'itemList',
        `/organizations/${organization.slug}/repos/`,
        {query: {status: 'active', integration_id: integration.id}},
      ],
    ];
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
    RepositoryStore.resetRepositories();
  };

  debouncedSearchRepositoriesRequest = debounce(
    query => this.searchRepositoriesRequest(query),
    200
  );

  searchRepositoriesRequest = (searchQuery?: string) => {
    const {organization, integration} = this.props;
    const query = {search: searchQuery};
    const endpoint = `/organizations/${organization.slug}/integrations/${integration.id}/repos/`;
    return this.api.request(endpoint, {
      method: 'GET',
      query,
      success: data => {
        this.setState({integrationRepos: data, dropdownBusy: false});
      },
      error: error => {
        this.setState({dropdownBusy: false, integrationReposErrorStatus: error?.status});
      },
    });
  };

  handleSearchRepositories = (e?: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({dropdownBusy: true, integrationReposErrorStatus: null});
    this.debouncedSearchRepositoriesRequest(e?.target.value);
  };

  addRepo(selection: {label: JSX.Element; searchKey: string; value: string}) {
    const {integration, organization} = this.props;
    const {itemList} = this.state;

    this.setState({adding: true});

    const migratableRepo = itemList.filter(item => {
      if (!(selection.value && item.externalSlug)) {
        return false;
      }
      return selection.value === item.externalSlug;
    })[0];

    let promise: Promise<Repository>;
    if (migratableRepo) {
      promise = migrateRepository(
        this.api,
        organization.slug,
        migratableRepo.id,
        integration
      );
    } else {
      promise = addRepository(this.api, organization.slug, selection.value, integration);
    }
    promise.then(
      (repo: Repository) => {
        this.setState({adding: false, itemList: itemList.concat(repo)});
        RepositoryStore.resetRepositories();
      },
      () => this.setState({adding: false})
    );
  }

  renderDropdown() {
    if (
      !['github', 'gitlab'].includes(this.props.integration.provider.key) &&
      !this.props.organization.access.includes('org:integrations')
    ) {
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

  renderBody() {
    const {itemListPageLinks, integrationReposErrorStatus, itemList} = this.state;
    return (
      <Fragment>
        {integrationReposErrorStatus === 400 && (
          <Alert type="error" showIcon>
            {t(
              'We were unable to fetch repositories for this integration. Try again later. If this error continues, please reconnect this integration by uninstalling and then reinstalling.'
            )}
          </Alert>
        )}

        <Panel>
          <PanelHeader hasButtons>
            <div>{t('Repositories')}</div>
            <DropdownWrapper>{this.renderDropdown()}</DropdownWrapper>
          </PanelHeader>
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
                orgSlug={this.props.organization.slug}
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

const StyledReposLabel = styled('div')`
  width: 250px;
  font-size: 0.875em;
  padding: ${space(1)} 0;
  text-transform: uppercase;
`;

const DropdownWrapper = styled('div')`
  text-transform: none;
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
