import {Fragment} from 'react';

import {ExternalLink} from '@sentry/scraps/link';

import {hasEveryAccess} from 'sentry/components/acl/access';
import EmptyMessage from 'sentry/components/emptyMessage';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import {IconFlag} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project, ProjectKey} from 'sentry/types/project';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

import KeyRow from './keyRow';

type Props = {
  keyList: ProjectKey[];
  onRemove: (data: ProjectKey) => void;
  onToggle: (isActive: boolean, data: ProjectKey) => void;
  organization: Organization;
  pageLinks: string | null | undefined;
  project: Project;
} & Pick<RouteComponentProps, 'routes' | 'location' | 'params'>;

export function ClientKeysTab({
  organization,
  project,
  keyList,
  onToggle,
  onRemove,
  pageLinks,
  routes,
  location,
  params,
}: Props) {
  const isEmpty = !keyList.length;
  const hasAccess = hasEveryAccess(['project:write'], {organization, project});

  return (
    <Fragment>
      <TextBlock>
        {tct(
          `To send data to Sentry you will need to configure an SDK with a client key
          (usually referred to as the [code:SENTRY_DSN] value). For more
          information on integrating Sentry with your application take a look at our
          [link:documentation].`,
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platform-redirect/?next=/configuration/options/" />
            ),
            code: <code />,
          }
        )}
      </TextBlock>

      <ProjectPermissionAlert project={project} />

      {isEmpty ? (
        <Panel>
          <EmptyMessage icon={<IconFlag />}>
            {t('There are no keys active for this project.')}
          </EmptyMessage>
        </Panel>
      ) : (
        <Fragment>
          {keyList.map(key => (
            <KeyRow
              hasWriteAccess={hasAccess}
              key={key.id}
              projectId={project.slug}
              project={project}
              organization={organization}
              data={key}
              onToggle={onToggle}
              onRemove={onRemove}
              routes={routes}
              location={location}
              params={params}
            />
          ))}
          <Pagination pageLinks={pageLinks} />
        </Fragment>
      )}
    </Fragment>
  );
}
