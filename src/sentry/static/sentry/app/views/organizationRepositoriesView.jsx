import React from 'react';

import {sortArray} from '../utils';
import {t} from '../locale';
import IndicatorStore from '../stores/indicatorStore';
import OrganizationSettingsView from './organizationSettingsView';
import LazyLoad from '../components/lazyLoad';
import getSettingsComponent from '../utils/getSettingsComponent';

class OrganizationRepositoriesView extends OrganizationSettingsView {
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
      <LazyLoad
        component={() =>
          getSettingsComponent(
            () =>
              import(/*webpackChunkName: "organizationRepositories"*/ './settings/organization/repositories/organizationRepositories'),
            () =>
              import(/*webpackChunkName: "organizationRepositories.old"*/ './organizationRepositories.old'),
            this.props.routes
          )}
        {...this.props}
        {...this.state}
        onAddRepo={this.onAddRepo}
        onCancelDelete={this.cancelDelete}
        onDeleteRepo={this.deleteRepo}
      />
    );
  }
}

export default OrganizationRepositoriesView;
