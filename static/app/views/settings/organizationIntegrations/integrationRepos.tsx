import {Fragment} from 'react';

import {Alert} from 'sentry/components/alert';
import {LinkButton} from 'sentry/components/button';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import EmptyMessage from 'sentry/components/emptyMessage';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import RepositoryRow from 'sentry/components/repositoryRow';
import {IconCommit} from 'sentry/icons';
import {t} from 'sentry/locale';
import RepositoryStore from 'sentry/stores/repositoryStore';
import type {Integration, Repository} from 'sentry/types/integrations';
import type {WithRouterProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';

import {IntegrationReposAddRepository} from './integrationReposAddRepository';

type Props = DeprecatedAsyncComponent['props'] &
  WithRouterProps & {
    integration: Integration;
    organization: Organization;
  };

type State = DeprecatedAsyncComponent['state'] & {
  integrationReposErrorStatus: number | null | undefined;
  itemList: Repository[];
};

class IntegrationRepos extends DeprecatedAsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      itemList: [],
      integrationReposErrorStatus: null,
    };
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
  onRepositoryChange = (data: Repository) => {
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

  handleSearchError = (errorStatus: number | null | undefined) => {
    this.setState({integrationReposErrorStatus: errorStatus});
  };

  handleAddRepository = (repo: Repository) => {
    this.setState(state => ({
      itemList: [...state.itemList, repo],
    }));
  };

  renderBody() {
    const {integration} = this.props;
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
            <IntegrationReposAddRepository
              integration={integration}
              currentRepositories={itemList}
              onSearchError={this.handleSearchError}
              onAddRepository={this.handleAddRepository}
            />
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
                  <LinkButton href="https://docs.sentry.io/product/releases/" external>
                    {t('Learn More')}
                  </LinkButton>
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
        <Pagination pageLinks={itemListPageLinks} />
      </Fragment>
    );
  }
}

export default withOrganization(withSentryRouter(IntegrationRepos));
