import {Box, Flex} from 'grid-emotion';
import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  removeIndicator,
} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/buttons/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import IndicatorStore from 'app/stores/indicatorStore';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';

const ROUTE_PREFIX = '/settings/account/api/';

const ApiApplicationRow = createReactClass({
  displayName: 'ApiApplicationRow',

  propTypes: {
    app: PropTypes.object.isRequired,
    onRemove: PropTypes.func.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: false,
    };
  },

  handleRemove() {
    if (this.state.loading) return;

    let app = this.props.app;

    this.setState(
      {
        loading: true,
      },
      () => {
        let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
        this.api.request(`/api-applications/${app.id}/`, {
          method: 'DELETE',
          success: data => {
            IndicatorStore.remove(loadingIndicator);
            this.props.onRemove(app);
          },
          error: () => {
            IndicatorStore.remove(loadingIndicator);
            IndicatorStore.add(
              t('Unable to remove application. Please try again.'),
              'error',
              {
                duration: 3000,
              }
            );
          },
        });
      }
    );
  },

  render() {
    let app = this.props.app;

    let btnClassName = 'btn btn-default';
    if (this.state.loading) btnClassName += ' disabled';

    return (
      <PanelItem justify="space-between" px={2} py={2}>
        <Box flex="1">
          <h4 style={{marginBottom: 5}}>
            <Link to={`${ROUTE_PREFIX}applications/${app.id}/`}>{app.name}</Link>
          </h4>
          <small style={{color: '#999'}}>{app.clientID}</small>
        </Box>

        <Flex align="center">
          <Box pl={2}>
            <a
              onClick={this.handleRemove}
              className={btnClassName}
              disabled={this.state.loading}
            >
              <span className="icon icon-trash" />
            </a>
          </Box>
        </Flex>
      </PanelItem>
    );
  },
});

class ApiApplications extends AsyncView {
  static contextTypes = {
    router: PropTypes.object.isRequired,
  };

  getEndpoints() {
    return [['appList', '/api-applications/']];
  }

  getTitle() {
    return 'API Applications';
  }

  handleCreateApplication = () => {
    let indicator = addLoadingMessage();
    this.api.request('/api-applications/', {
      method: 'POST',
      success: app => {
        addSuccessMessage(t('Created a new API Application'));
        removeIndicator(indicator);
        this.context.router.push(`${ROUTE_PREFIX}applications/${app.id}/`);
      },
      error: error => {
        removeIndicator(indicator);
        addErrorMessage(t('Unable to remove application. Please try again.'));
      },
    });
  };

  handleRemoveApplication = app => {
    this.setState({
      appList: this.state.appList.filter(a => a.id !== app.id),
    });
  };

  renderBody() {
    let action = (
      <Button
        priority="primary"
        size="small"
        className="ref-create-application"
        onClick={this.handleCreateApplication}
        icon="icon-circle-add"
      >
        {t('Create New Application')}
      </Button>
    );

    let isEmpty = this.state.appList.length === 0;

    return (
      <div>
        <SettingsPageHeader title="API Applications" action={action} />

        <Panel>
          <PanelHeader disablePadding>
            <Flex align="center">
              <Box px={2} flex="1">
                {t('Application Name')}
              </Box>
            </Flex>
          </PanelHeader>

          <PanelBody>
            {!isEmpty ? (
              this.state.appList.map(app => {
                return (
                  <ApiApplicationRow
                    key={app.id}
                    app={app}
                    onRemove={this.handleRemoveApplication}
                  />
                );
              })
            ) : (
              <EmptyMessage>
                {t("You haven't created any applications yet.")}
              </EmptyMessage>
            )}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

export default ApiApplications;
