import {Component} from 'react';
import {RouteComponentProps} from 'react-router';

import Access from 'sentry/components/acl/access';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {
  Panel,
  PanelAlert,
  PanelBody,
  PanelHeader,
  PanelItem,
} from 'sentry/components/panels';
import {t, tct} from 'sentry/locale';
import {Organization, Plugin, Project} from 'sentry/types';
import RouteError from 'sentry/views/routeError';

import ProjectPluginRow from './projectPluginRow';

type Props = {
  error: React.ComponentProps<typeof RouteError>['error'];
  loading: boolean;
  onChange: React.ComponentProps<typeof ProjectPluginRow>['onChange'];
  organization: Organization;
  plugins: Plugin[];
  project: Project;
} & RouteComponentProps<{}, {}>;

class ProjectPlugins extends Component<Props> {
  render() {
    const {plugins, loading, error, onChange, routes, organization, project} = this.props;
    const hasError = error;
    const isLoading = !hasError && loading;

    if (hasError) {
      return <RouteError error={error} />;
    }

    if (isLoading) {
      return <LoadingIndicator />;
    }
    const params = {orgId: organization.slug, projectId: project.slug};

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
                        link: <Link to={`/settings/${organization.slug}/integrations`} />,
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
                  project={project}
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
