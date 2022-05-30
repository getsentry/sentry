import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {Repository} from 'sentry/types';
import routeTitleGen from 'sentry/utils/routeTitle';
import AsyncView from 'sentry/views/asyncView';

import OrganizationRepositories from './organizationRepositories';

type Props = RouteComponentProps<{orgId: string}, {}> & AsyncView['props'];

type State = AsyncView['state'] & {
  itemList: Repository[] | null;
};

export default class OrganizationRepositoriesContainer extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {orgId} = this.props.params;
    return [['itemList', `/organizations/${orgId}/repos/`, {query: {status: ''}}]];
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
    const {orgId} = this.props.params;
    return routeTitleGen(t('Repositories'), orgId, false);
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
