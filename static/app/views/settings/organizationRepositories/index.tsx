import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {Organization, Repository} from 'sentry/types';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';

import OrganizationRepositories from './organizationRepositories';

type Props = RouteComponentProps<{}, {}> & {
  organization: Organization;
} & DeprecatedAsyncView['props'];

type State = DeprecatedAsyncView['state'] & {
  itemList: Repository[] | null;
};

class OrganizationRepositoriesContainer extends DeprecatedAsyncView<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    const {organization} = this.props;
    return [['itemList', `/organizations/${organization.slug}/repos/`]];
  }

  // Callback used by child component to signal state change
  onRepositoryChange = (data: Pick<Repository, 'id' | 'status'>) => {
    const itemList = this.state.itemList;
    itemList?.forEach(item => {
      if (item.id === data.id) {
        item.status = data.status;
      }
    });
    this.setState({itemList});
  };

  getTitle() {
    const {organization} = this.props;
    return routeTitleGen(t('Repositories'), organization.slug, false);
  }

  renderBody() {
    const {itemList, itemListPageLinks} = this.state;

    return (
      <Fragment>
        <OrganizationRepositories
          {...this.props}
          itemList={itemList!}
          onRepositoryChange={this.onRepositoryChange}
        />
        {itemListPageLinks && (
          <Pagination pageLinks={itemListPageLinks} {...this.props} />
        )}
      </Fragment>
    );
  }
}

export default withOrganization(OrganizationRepositoriesContainer);
