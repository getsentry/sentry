import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import SentryTypes from 'app/proptypes';
import {t} from 'app/locale';

import ApiMixin from 'app/mixins/apiMixin';

import Button from 'app/components/buttons/button';
import Confirm from 'app/components/confirm';
import IndicatorStore from 'app/stores/indicatorStore';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import EmptyStateWarning from 'app/components/emptyStateWarning';

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
                <Button size="small">
                  <span className="icon icon-trash" />
                </Button>
              </Confirm>
            </InputColumn>
          )}
        </Flex>
      </PanelItem>
    );
  }
}

const ProjectSavedSearches = createReactClass({
  displayName: 'ProjectSavedSearches',
  contextTypes: {
    organization: SentryTypes.Organization,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      savedSearchList: [],
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/searches/`, {
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          savedSearchList: data,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  },

  handleUpdate(params) {
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
  },

  handleRemovedSearch(params) {
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
  },

  renderBody() {
    let body;

    if (this.state.loading) body = this.renderLoading();
    else if (this.state.error) body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.savedSearchList.length > 0) body = this.renderResults();
    else body = this.renderEmpty();

    return body;
  },

  renderLoading() {
    return <LoadingIndicator />;
  },

  renderEmpty() {
    return (
      <EmptyStateWarning>
        <p>{t('There are no saved searches for this project.')}</p>
      </EmptyStateWarning>
    );
  },

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
  },

  render() {
    let {organization} = this.context;
    let access = organization && new Set(organization.access);
    let canModify = (organization && access.has('project:write')) || false;

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
          <PanelBody>{this.renderBody()}</PanelBody>
        </Panel>
      </div>
    );
  },
});

export default ProjectSavedSearches;
export {SavedSearchRow};
