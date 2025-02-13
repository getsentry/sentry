import {Component} from 'react';

import Access from 'sentry/components/acl/access';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {t, tct} from 'sentry/locale';
import type {Plugin} from 'sentry/types/integrations';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
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
      <Access access={['org:integrations']} project={project}>
        {({hasAccess}) => (
          <Panel>
            <PanelHeader>
              <div>{t('Legacy Integration')}</div>
              <div />
            </PanelHeader>
            <PanelBody>
              <PanelAlert margin={false} type="warning">
                {hasAccess
                  ? tct(
                      "Legacy Integrations must be configured per-project. It's recommended to prefer organization integrations over the legacy project integrations when available. Visit the [link:organization integrations] settings to manage them.",
                      {
                        link: <Link to={`/settings/${organization.slug}/integrations`} />,
                      }
                    )
                  : t(
                      "Legacy Integrations must be configured per-project. It's recommended to prefer organization integrations over the legacy project integrations when available."
                    )}
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
        )}
      </Access>
    );
  }
}

export default ProjectPlugins;
