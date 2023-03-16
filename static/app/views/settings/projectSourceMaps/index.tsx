import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import ExternalLink from 'sentry/components/links/externalLink';
import ListLink from 'sentry/components/links/listLink';
import NavTabs from 'sentry/components/navTabs';
import {t, tct} from 'sentry/locale';
import {Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import ProjectSourceMapsDetail from 'sentry/views/settings/projectSourceMaps/detail';
import ProjectSourceMapsList from 'sentry/views/settings/projectSourceMaps/list';

import {ProjectSourceMaps} from './projectSourceMaps';
import {ProjectSourceMapsArtifacts} from './projectSourceMapsArtifacts';

type Props = RouteComponentProps<
  {orgId: string; projectId: string; bundleId?: string; name?: string},
  {}
> & {
  children: React.ReactNode;
  project: Project;
};

export function ProjectSourceMapsContainer({params, location, ...props}: Props) {
  const organization = useOrganization();
  const sourceMapsDebugIds = organization.features.includes('source-maps-debug-ids');

  if (!sourceMapsDebugIds) {
    if (params.name) {
      return (
        <ProjectSourceMapsDetail
          {...props}
          location={location}
          params={{...params, name: params.name}}
          organization={organization}
        />
      );
    }
    return (
      <ProjectSourceMapsList
        {...props}
        location={location}
        params={params}
        organization={organization}
      />
    );
  }

  const releaseBundlesUrl = normalizeUrl(
    `/settings/${params.orgId}/projects/${params.projectId}/source-maps/release-bundles/${
      params.bundleId ? `${params.bundleId}/` : ''
    }`
  );

  const debugIdsUrl = normalizeUrl(
    `/settings/${params.orgId}/projects/${
      params.projectId
    }/source-maps/debug-id-bundles/${params.bundleId ? `${params.bundleId}/` : ''}`
  );

  const tabDebugIdBundlesActive = location.pathname === debugIdsUrl;
  const tab = tabDebugIdBundlesActive ? 'debug-id' : 'release';

  return (
    <Fragment>
      <SettingsPageHeader title={t('Source Maps')} />
      <TextBlock>
        {tct(
          `These source map archives help Sentry identify where to look when Javascript is minified. By providing this information, you can get better context for your stack traces when debugging. To learn more about source maps, [link: read the docs].`,
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/sourcemaps/" />
            ),
          }
        )}
      </TextBlock>
      <NavTabs underlined>
        <ListLink to={releaseBundlesUrl} index isActive={() => !tabDebugIdBundlesActive}>
          {t('Release Bundles')}
        </ListLink>
        <ListLink to={debugIdsUrl} isActive={() => tabDebugIdBundlesActive}>
          {t('Debug ID Bundles')}
        </ListLink>
      </NavTabs>
      {params.bundleId ? (
        <ProjectSourceMapsArtifacts
          {...props}
          tab={tab}
          location={location}
          params={{...params, bundleId: params.bundleId}}
        />
      ) : (
        <ProjectSourceMaps {...props} tab={tab} location={location} params={params} />
      )}
    </Fragment>
  );
}
