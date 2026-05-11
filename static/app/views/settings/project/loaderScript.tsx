import {Fragment, useCallback, useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import {LinkButton} from '@sentry/scraps/button';
import {ExternalLink, Link} from '@sentry/scraps/link';

import {EmptyMessage} from 'sentry/components/emptyMessage';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelAlert} from 'sentry/components/panels/panelAlert';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project, ProjectKey} from 'sentry/types/project';
import {projectKeysApiOptions} from 'sentry/utils/projectKeys';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {LoaderSettings} from 'sentry/views/settings/project/projectKeys/details/loaderSettings';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

export default function ProjectLoaderScript() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const [updatedProjectKeys, setUpdatedProjectKeys] = useState<ProjectKey[]>([]);

  const {
    data: projectKeys,
    isPending,
    error,
    refetch: refetchProjectKeys,
  } = useQuery(
    projectKeysApiOptions({orgSlug: organization.slug, projSlug: project.slug})
  );

  const handleUpdateProjectKey = useCallback(
    (projectKey: ProjectKey) => {
      const existingProjectIndex = updatedProjectKeys.findIndex(
        key => key.id === projectKey.id
      );
      const newUpdatedProjectKeys =
        existingProjectIndex > -1
          ? [...updatedProjectKeys].map((updatedProjectKey, index) => {
              return index === existingProjectIndex ? projectKey : updatedProjectKey;
            })
          : [...updatedProjectKeys, projectKey];

      setUpdatedProjectKeys(newUpdatedProjectKeys);
    },
    [updatedProjectKeys]
  );

  return (
    <Fragment>
      <SettingsPageHeader
        title={t('Loader Script')}
        subtitle={tct(
          'The Loader Script is the easiest way to initialize the Sentry SDK. The Loader Script automatically keeps your Sentry SDK up to date and offers configuration for different Sentry features. [docsLink:Learn more about the Loader Script]. Note: The Loader Script is bound to a Client Key (DSN), to create a new Script, go to the [clientKeysLink:Client Keys page].',
          {
            docsLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/install/loader/" />
            ),
            clientKeysLink: (
              <Link
                to={`/settings/${organization.slug}/projects/${project.slug}/keys/`}
              />
            ),
          }
        )}
      />

      {isPending && <LoadingIndicator />}
      {!!error && (
        <LoadingError
          message={t('Failed to load project keys.')}
          onRetry={refetchProjectKeys}
        />
      )}
      {!isPending && !error && !projectKeys?.length && (
        <EmptyMessage title={t('There are no keys active for this project.')} />
      )}

      {projectKeys?.map(key => {
        const actualKey =
          updatedProjectKeys.find(updatedKey => updatedKey.id === key.id) ?? key;
        return (
          <LoaderItem
            key={actualKey.id}
            organization={organization}
            project={project}
            projectKey={actualKey}
            onUpdateProjectKey={handleUpdateProjectKey}
          />
        );
      })}
    </Fragment>
  );
}

function LoaderItem({
  organization,
  project,
  projectKey,
  onUpdateProjectKey,
}: {
  onUpdateProjectKey: (projectKey: ProjectKey) => void;
  organization: Organization;
  project: Project;
  projectKey: ProjectKey;
}) {
  return (
    <Panel>
      <PanelHeader hasButtons>
        {tct('Client Key: [name]', {name: projectKey.name})}

        <LinkButton
          size="xs"
          to={`/settings/${organization.slug}/projects/${project.slug}/keys/${projectKey.id}/`}
        >
          {t('View Key Details')}
        </LinkButton>
      </PanelHeader>
      <PanelBody>
        <PanelAlert variant="info">
          {t('Note that it can take a few minutes until changed options are live.')}
        </PanelAlert>

        <LoaderSettings
          orgSlug={organization.slug}
          keyId={projectKey.id}
          project={project}
          data={projectKey}
          updateData={onUpdateProjectKey}
        />
      </PanelBody>
    </Panel>
  );
}
