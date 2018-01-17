import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {t} from '../locale';
import ApiMixin from '../mixins/apiMixin';
import Button from '../components/buttons/button';
import Confirm from '../components/confirm';
import IndicatorStore from '../stores/indicatorStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import Panel from './settings/components/panel';
import PanelBody from './settings/components/panelBody';
import PanelHeader from './settings/components/panelHeader';
import Row from './settings/components/row';
import SettingsPageHeader from './settings/components/settingsPageHeader';
import SentryTypes from '../proptypes';

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
      <Row py={2} align="center">
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
      </Row>
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
    return (
      <Panel>
        <LoadingIndicator />
      </Panel>
    );
  },

  renderEmpty() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{t('There are no saved searches for this project.')}</p>
      </div>
    );
  },

  renderResults() {
    let {orgId, projectId} = this.props.params;
    let {organization} = this.context;
    let access = organization && new Set(organization.access);
    let canModify = (organization && access.has('project:write')) || false;

    return (
      <Panel>
        <PanelHeader disablePadding>
          <Flex>
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

        <PanelBody>
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
        </PanelBody>
      </Panel>
    );
  },

  render() {
    return (
      <div>
        <SettingsPageHeader title={t('Saved Searches')} />

        {this.renderBody()}
      </div>
    );
  },
});

export default ProjectSavedSearches;
export {SavedSearchRow};
