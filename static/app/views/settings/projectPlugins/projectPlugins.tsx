import {Link} from '@sentry/scraps/link';

import {Access} from 'sentry/components/acl/access';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelAlert} from 'sentry/components/panels/panelAlert';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {PanelItem} from 'sentry/components/panels/panelItem';
import {t, tct} from 'sentry/locale';
import type {Plugin} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';
import {RouteError} from 'sentry/views/routeError';

import {ProjectPluginRow} from './projectPluginRow';

type Props = {
  error: React.ComponentProps<typeof RouteError>['error'];
  loading: boolean;
  onChange: React.ComponentProps<typeof ProjectPluginRow>['onChange'];
  plugins: Plugin[];
  project: Project;
};

export function ProjectPlugins({plugins, loading, error, onChange, project}: Props) {
  const organization = useOrganization();

  const hasError = error;
  const isLoading = !hasError && loading;

  if (hasError) {
    return <RouteError error={error} />;
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  return (
    <Access access={['org:integrations']} project={project}>
      {({hasAccess}) => (
        <Panel>
          <PanelHeader>
            <div>{t('Legacy Integration')}</div>
            <div />
          </PanelHeader>
          <PanelBody>
            <PanelAlert variant="warning">
              {hasAccess
                ? tct(
                    "Legacy Integrations must be configured per-project. It's recommended to prefer organization integrations over the legacy project integrations when available. Visit the [link:organization integrations] settings to manage them.",
                    {
                      link: <Link to={`/settings/${organization.slug}/integrations/`} />,
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
                  <ProjectPluginRow project={project} {...plugin} onChange={onChange} />
                </PanelItem>
              ))}
          </PanelBody>
        </Panel>
      )}
    </Access>
  );
}
