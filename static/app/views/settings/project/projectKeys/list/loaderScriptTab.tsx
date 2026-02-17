import {Fragment, useCallback, useState} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {ExternalLink} from '@sentry/scraps/link';

import EmptyMessage from 'sentry/components/emptyMessage';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project, ProjectKey} from 'sentry/types/project';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {LoaderSettings} from 'sentry/views/settings/project/projectKeys/details/loaderSettings';

type Props = {
  keyList: ProjectKey[];
  organization: Organization;
  project: Project;
};

export function LoaderScriptTab({organization, project, keyList}: Props) {
  const [updatedProjectKeys, setUpdatedProjectKeys] = useState<ProjectKey[]>([]);

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
      <TextBlock>
        {tct(
          'The Loader Script is the easiest way to initialize the Sentry SDK. The Loader Script automatically keeps your Sentry SDK up to date and offers configuration for different Sentry features. [docsLink:Learn more about the Loader Script].',
          {
            docsLink: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/install/loader/" />
            ),
          }
        )}
      </TextBlock>

      {!keyList.length && (
        <EmptyMessage title={t('There are no keys active for this project.')} />
      )}

      {keyList.map(key => {
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
