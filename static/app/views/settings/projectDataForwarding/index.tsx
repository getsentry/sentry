import {Fragment} from 'react';

import {hasEveryAccess} from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {Alert} from 'sentry/components/core/alert';
import {ExternalLink} from 'sentry/components/core/link';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PluginList from 'sentry/components/pluginList';
import {t, tct} from 'sentry/locale';
import type {Plugin} from 'sentry/types/integrations';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

export default function ProjectDataForwarding() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();

  const {
    data: plugins = [],
    isPending,
    isError,
    refetch,
  } = useApiQuery<Plugin[]>([`/projects/${organization.slug}/${project.slug}/plugins/`], {
    staleTime: 0,
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const forwardingPlugins = () => {
    return plugins.filter(p => p.type === 'data-forwarding' && p.hasConfiguration);
  };

  const hasAccess = hasEveryAccess(['project:write'], {organization, project});

  const pluginsPanel =
    plugins.length > 0 ? (
      <PluginList project={project} pluginList={forwardingPlugins()} />
    ) : (
      <Panel>
        <EmptyMessage
          title={t('There are no integrations available for data forwarding')}
        />
      </Panel>
    );

  return (
    <div data-test-id="data-forwarding-settings">
      <Feature
        features="projects:data-forwarding"
        hookName="feature-disabled:data-forwarding"
      >
        {({hasFeature, features}) => (
          <Fragment>
            <SettingsPageHeader title={t('Data Forwarding')} />
            <TextBlock>
              {tct(
                `Data Forwarding allows processed events to be sent to your
                favorite business intelligence tools. The exact payload and
                types of data depend on the integration you're using. Learn
                more about this functionality in our [link:documentation].`,
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/product/data-management-settings/data-forwarding/" />
                  ),
                }
              )}
            </TextBlock>
            <ProjectPermissionAlert project={project} />

            <Alert.Container>
              <Alert variant="info">
                {tct(
                  `Sentry forwards [em:all applicable error events] to the provider, in
                some cases this may be a significant volume of data.`,
                  {
                    em: <strong />,
                  }
                )}
              </Alert>
            </Alert.Container>

            {!hasFeature && (
              <FeatureDisabled
                alert
                featureName={t('Data Forwarding')}
                features={features}
              />
            )}

            {hasAccess && hasFeature && pluginsPanel}
          </Fragment>
        )}
      </Feature>
    </div>
  );
}
