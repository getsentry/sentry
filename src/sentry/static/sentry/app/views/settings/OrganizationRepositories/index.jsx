import React from 'react';

import {sortArray} from 'app/utils';
import {t} from 'app/locale';
import IndicatorStore from 'app/stores/indicatorStore';
import AsyncView from 'app/views/asyncView';

import OrganizationRepositories from './organizationRepositories';

export default class OrganizationRepositoriesContainer extends AsyncView {
  getEndpoints() {
    let {orgId} = this.props.params;
    return [
      ['itemList', `/organizations/${orgId}/repos/`, {query: {status: ''}}],
      ['repoConfig', `/organizations/${orgId}/config/repos/`],
    ];
  }

  deleteRepo = repo => {
    let indicator = IndicatorStore.add(t('Saving changes..'));
    this.api.request(`/organizations/${this.props.params.orgId}/repos/${repo.id}/`, {
      method: 'DELETE',
      success: data => {
        let itemList = this.state.itemList;
        itemList.forEach(item => {
          if (item.id === data.id) {
            item.status = data.status;
          }
        });
        this.setState({
          itemList,
        });
      },
      error: () => {
        IndicatorStore.add(t('An error occurred.'), 'error', {
          duration: 3000,
        });
      },
      complete: () => {
        IndicatorStore.remove(indicator);
      },
    });
  };

  cancelDelete = repo => {
    let indicator = IndicatorStore.add(t('Saving changes..'));
    this.api.request(`/organizations/${this.props.params.orgId}/repos/${repo.id}/`, {
      method: 'PUT',
      data: {status: 'visible'},
      success: data => {
        let itemList = this.state.itemList;
        itemList.forEach(item => {
          if (item.id === data.id) {
            item.status = data.status;
          }
        });
        this.setState({
          itemList,
        });
      },
      error: () => {
        IndicatorStore.add(t('An error occurred.'), 'error', {
          duration: 3000,
        });
      },
      complete: () => {
        IndicatorStore.remove(indicator);
      },
    });
  };

  onAddRepo = repo => {
    let itemList = this.state.itemList;
    itemList.push(repo);
    this.setState({
      itemList: sortArray(itemList, item => item.name),
    });
  };

  getTitle() {
    return 'Repositories';
  }

  renderBody() {
    return (
      <OrganizationRepositories
        {...this.props}
        {...this.state}
        onAddRepo={this.onAddRepo}
        onCancelDelete={this.cancelDelete}
        onDeleteRepo={this.deleteRepo}
      />
    );
  }
}
