import PropTypes from 'prop-types';
import { Component } from 'react';
import * as React from 'react';
import {WithRouterProps} from 'react-router';

import {
  Panel,
  PanelAlert,
  PanelBody,
  PanelHeader,
  PanelItem,
} from 'app/components/panels';
import {t, tct} from 'app/locale';
import Access from 'app/components/acl/access';
import Link from 'app/components/links/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import RouteError from 'app/views/routeError';
import SentryTypes from 'app/sentryTypes';
import {Plugin} from 'app/types';

import ProjectPluginRow from './projectPluginRow';

type Props = {
  plugins: Plugin[];
  loading: boolean;
  error: React.ComponentProps<typeof RouteError>['error'];
  onChange: React.ComponentProps<typeof ProjectPluginRow>['onChange'];
} & WithRouterProps<{orgId: string}>;

class ProjectPlugins extends Component<Props> {
  static propTypes = {
    plugins: PropTypes.arrayOf(SentryTypes.PluginShape),
    loading: PropTypes.bool,
    error: PropTypes.any,
    onChange: PropTypes.func,
    onError: PropTypes.func,
    routes: PropTypes.array,
  };

  render() {
    const {plugins, loading, error, onChange, routes, params} = this.props;
    const {orgId} = this.props.params;
    const hasError = error;
    const isLoading = !hasError && loading;

    if (hasError) {
      return <RouteError error={error} />;
    }

    if (isLoading) {
      return <LoadingIndicator />;
    }

    return (
      <Panel>
        <PanelHeader>
          <div>{t('Legacy Integration')}</div>
          <div>{t('Enabled')}</div>
        </PanelHeader>
        <PanelBody>
          <PanelAlert type="warning">
            <Access access={['org:integrations']}>
              {({hasAccess}) =>
                hasAccess
                  ? tct(
                      "Legacy Integrations must be configured per-project. It's recommended to prefer organization integrations over the legacy project integrations when available. Visit the [link:organization integrations] settings to manage them.",
                      {
                        link: <Link to={`/settings/${orgId}/integrations`} />,
                      }
                    )
                  : t(
                      "Legacy Integrations must be configured per-project. It's recommended to prefer organization integrations over the legacy project integrations when available."
                    )
              }
            </Access>
          </PanelAlert>

          {plugins
            .filter(p => {
              return !p.isHidden;
            })
            .map(plugin => (
              <PanelItem key={plugin.id}>
                <ProjectPluginRow
                  params={params}
                  routes={routes}
                  {...plugin}
                  onChange={onChange}
                />
              </PanelItem>
            ))}
        </PanelBody>
      </Panel>
    );
  }
}

export default ProjectPlugins;
