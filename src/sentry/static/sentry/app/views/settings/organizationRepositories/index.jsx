import React from 'react';

import {sortArray} from 'app/utils';
import AsyncView from 'app/views/asyncView';
import Pagination from 'app/components/pagination';
import {t} from 'app/locale';
import routeTitleGen from 'app/utils/routeTitle';

import OrganizationRepositories from './organizationRepositories';

export default class OrganizationRepositoriesContainer extends AsyncView {
  getEndpoints() {
    const {orgId} = this.props.params;
    return [
      ['itemList', `/organizations/${orgId}/repos/`, {query: {status: ''}}],
      ['repoConfig', `/organizations/${orgId}/config/repos/`],
    ];
  }

  // Callback used by child component to signal state change
  onRepositoryChange = data => {
    const itemList = this.state.itemList;
    itemList.forEach(item => {
      if (item.id === data.id) {
        item.status = data.status;
      }
    });
    this.setState({itemList});
  };

  onAddRepo = repo => {
    const itemList = this.state.itemList;
    itemList.push(repo);
    this.setState({
      itemList: sortArray(itemList, item => item.name),
    });
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
          {...this.state}
          api={this.api}
          onAddRepo={this.onAddRepo}
          onRepositoryChange={this.onRepositoryChange}
        />
        {this.state.itemListPageLinks && (
          <Pagination pageLinks={this.state.itemListPageLinks} {...this.props} />
        )}
      </React.Fragment>
    );
  }
}
