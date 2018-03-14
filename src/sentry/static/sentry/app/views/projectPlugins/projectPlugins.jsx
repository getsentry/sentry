import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React, {Fragment, Component} from 'react';

import {t} from '../../locale';
import LoadingIndicator from '../../components/loadingIndicator';
import Panel from '../settings/components/panel';
import PanelItem from '../settings/components/panelItem';
import ProjectPluginRow from './projectPluginRow';
import RouteError from '../routeError';
import SentryTypes from '../../proptypes';

class ProjectPlugins extends Component {
  static propTypes = {
    plugins: PropTypes.arrayOf(SentryTypes.PluginShape),
    loading: PropTypes.bool,
    error: PropTypes.any,
    onChange: PropTypes.func,
    onError: PropTypes.func,
    routes: PropTypes.array,
  };

  render() {
    let {plugins, loading, error, onError, onChange, routes, params} = this.props;
    let hasError = error;
    let isLoading = !hasError && loading;

    if (hasError) {
      return <RouteError error={error} component={this} onRetry={onError} />;
    }

    if (isLoading) {
      return <LoadingIndicator />;
    }

    return (
      <Panel
        title={
          <Flex justify="space-between">
            <div>{t('Legacy Integration')}</div>
            <div>{t('Enabled')}</div>
          </Flex>
        }
        body={
          <Fragment>
            {plugins.map(plugin => (
              <PanelItem key={plugin.id}>
                <ProjectPluginRow
                  params={params}
                  routes={routes}
                  {...plugin}
                  onChange={onChange}
                />
              </PanelItem>
            ))}
          </Fragment>
        }
      />
    );
  }
}

export default ProjectPlugins;
