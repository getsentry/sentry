import React from 'react';
import {RouteComponentProps} from 'react-router';

import Pagination from 'app/components/pagination';
import {t} from 'app/locale';
import {Repository} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import AsyncView from 'app/views/asyncView';

import OrganizationRepositories from './organizationRepositories';

type Props = RouteComponentProps<{orgId: string}, {}> & AsyncView['props'];

type State = AsyncView['state'] & {
  itemList: Repository[] | null;
  repoConfig: any[] | null; // TODO
};

export default class OrganizationRepositoriesContainer extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {orgId} = this.props.params;
    return [
      ['itemList', `/organizations/${orgId}/repos/`, {query: {status: ''}}],
      ['repoConfig', `/organizations/${orgId}/config/repos/`],
    ];
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
    return (
      <React.Fragment>
        <OrganizationRepositories
          {...this.props}
          itemList={this.state.itemList!}
          api={this.api}
          onRepositoryChange={this.onRepositoryChange}
        />
        {this.state.itemListPageLinks && (
          <Pagination pageLinks={this.state.itemListPageLinks} {...this.props} />
        )}
      </React.Fragment>
    );
  }
}
