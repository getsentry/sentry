import PropTypes from 'prop-types';
import React from 'react';

import {t} from '../../locale';
import LoadingIndicator from '../../components/loadingIndicator';
import ProjectPluginRow from './projectPluginRow';
import RouteError from '../routeError';
import SentryTypes from '../../proptypes';

class ProjectPlugins extends React.Component {
  static propTypes = {
    plugins: PropTypes.arrayOf(SentryTypes.PluginShape),
    loading: PropTypes.bool,
    error: PropTypes.any,
    onChange: PropTypes.func,
    onError: PropTypes.func,
  };

  render() {
    let {plugins, loading, error, onError, onChange, params} = this.props;
    let {projectId, orgId} = params;
    let hasError = error;
    let isLoading = !hasError && loading;

    if (hasError) {
      return <RouteError error={error} component={this} onRetry={onError} />;
    }

    if (isLoading) {
      return <LoadingIndicator />;
    }

    return (
      <div className="panel panel-default">
        <table className="table integrations simple">
          <thead>
            <tr>
              <th colSpan={2}>{t('Legacy Integration')}</th>
              <th className="align-right">{t('Enabled')}</th>
            </tr>
          </thead>
          <tbody>
            {plugins.map(plugin => (
              <ProjectPluginRow
                key={plugin.id}
                projectId={projectId}
                orgId={orgId}
                {...plugin}
                onChange={onChange}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}

export default ProjectPlugins;
