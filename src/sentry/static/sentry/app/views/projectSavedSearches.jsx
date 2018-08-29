import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import IndicatorStore from 'app/stores/indicatorStore';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

const InputColumn = props => <Flex flex="1" justify="center" {...props} />;

const SearchTitle = styled.div`
  font-size: 18px;
  margin-bottom: 5px;
`;

class SavedSearchRow extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
    canModify: PropTypes.bool.isRequired,
    onDefault: PropTypes.func.isRequired,
    onUserDefault: PropTypes.func.isRequired,
    onRemove: PropTypes.func.isRequired,
  };

  handleRemove = () => {
    let {data, onRemove} = this.props;
    onRemove({data});
  };

  handleDefault = () => {
    let {data, onDefault} = this.props;
    onDefault({
      data,
      isDefault: true,
    });
  };

  handleUserDefault = () => {
    let {data, onUserDefault} = this.props;
    onUserDefault({
      data,
      isUserDefault: true,
    });
  };

  render() {
    let {data, canModify} = this.props;

    return (
      <PanelItem p={0} py={2} align="center">
        <Flex flex="1" px={2} direction="column">
          <SearchTitle>{data.name}</SearchTitle>
          <code>{data.query}</code>
        </Flex>
        <Flex flex="1">
          <InputColumn>
            <input
              type="radio"
              name="userDefault"
              checked={data.isUserDefault}
              onChange={this.handleUserDefault}
            />
          </InputColumn>

          {canModify && (
            <InputColumn>
              <input
                type="radio"
                name="default"
                checked={data.isDefault}
                onChange={this.handleDefault}
              />
            </InputColumn>
          )}

          {canModify && (
            <InputColumn>
              <Confirm
                message={t('Are you sure you want to remove this?')}
                onConfirm={this.handleRemove}
              >
                <Button size="small" icon="icon-trash" />
              </Confirm>
            </InputColumn>
          )}
        </Flex>
      </PanelItem>
    );
  }
}

class ProjectSavedSearches extends AsyncView {
  getTitle() {
    return t('Saved Searches');
  }
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  getEndpoints() {
    let {orgId, projectId} = this.props.params;
    return [['savedSearchList', `/projects/${orgId}/${projectId}/searches/`]];
  }

  handleUpdate = params => {
    let {orgId, projectId} = this.props.params;
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    let {data, isDefault, isUserDefault} = params;
    let key = typeof isDefault !== 'undefined' ? 'isDefault' : 'isUserDefault';
    let {savedSearchList} = this.state;
    let newSearchList = savedSearchList.map(search => ({
      ...search,
      [key]: data.id === search.id,
    }));

    this.setState(
      {
        savedSearchList: newSearchList,
      },
      () => {
        this.api.request(`/projects/${orgId}/${projectId}/searches/${data.id}/`, {
          method: 'PUT',
          data: {
            isDefault,
            isUserDefault,
          },
          error: () => {
            this.setState({
              savedSearchList,
            });
            IndicatorStore.addError(t('Error updating search'));
          },
          complete: () => {
            IndicatorStore.remove(loadingIndicator);
          },
        });
      }
    );
  };

  handleRemovedSearch = params => {
    let {orgId, projectId} = this.props.params;
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    let {data} = params;
    let {savedSearchList} = this.state;
    let newSearchList = savedSearchList.filter(search => {
      return search.id !== data.id;
    });

    this.setState(
      {
        savedSearchList: newSearchList,
      },
      () => {
        this.api.request(`/projects/${orgId}/${projectId}/searches/${data.id}/`, {
          method: 'DELETE',
          error: () => {
            this.setState({
              savedSearchList,
            });
            IndicatorStore.addError(t('Error removing search'));
          },
          complete: () => IndicatorStore.remove(loadingIndicator),
        });
      }
    );
  };

  renderEmpty() {
    return (
      <EmptyStateWarning>
        <p>{t('There are no saved searches for this project.')}</p>
      </EmptyStateWarning>
    );
  }

  renderResults() {
    let {orgId, projectId} = this.props.params;
    let {organization} = this.context;
    let access = organization && new Set(organization.access);
    let canModify = (organization && access.has('project:write')) || false;

    return (
      <React.Fragment>
        {this.state.savedSearchList.map(search => {
          return (
            <SavedSearchRow
              access={access}
              key={search.id}
              canModify={canModify}
              orgId={orgId}
              projectId={projectId}
              data={search}
              onUserDefault={this.handleUpdate}
              onDefault={this.handleUpdate}
              onRemove={this.handleRemovedSearch}
            />
          );
        })}
      </React.Fragment>
    );
  }

  renderBody() {
    let {organization} = this.context;
    let access = organization && new Set(organization.access);
    let canModify = (organization && access.has('project:write')) || false;
    let hasResults = this.state.savedSearchList.length > 0;

    return (
      <div>
        <SettingsPageHeader title={t('Saved Searches')} />
        <Panel>
          <PanelHeader disablePadding>
            <Flex flex="1">
              <Flex flex="1" px={2}>
                {t('Search')}
              </Flex>
              <Flex flex="1">
                <InputColumn>{t('My Default')}</InputColumn>
                {canModify && <InputColumn>{t('Team Default')}</InputColumn>}
                {canModify && <InputColumn>{t('Remove')}</InputColumn>}
              </Flex>
            </Flex>
          </PanelHeader>
          <PanelBody>{hasResults ? this.renderResults() : this.renderEmpty()}</PanelBody>
        </Panel>
      </div>
    );
  }
}

export default ProjectSavedSearches;
export {SavedSearchRow};
