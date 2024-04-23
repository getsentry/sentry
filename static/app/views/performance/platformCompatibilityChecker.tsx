import {useEffect, useMemo} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import type {PageFilters} from 'sentry/types';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import usePrevious from 'sentry/utils/usePrevious';
import useProjects from 'sentry/utils/useProjects';

const MAX_PROJECTS_TO_LIST = 3;

function getEventView(selection: PageFilters, compatibleSDKNames: string[]) {
  const {projects: selectedProjectIds} = selection;

  return EventView.fromNewQueryWithPageFilters(
    {
      dataset: DiscoverDatasets.SPANS_INDEXED,
      fields: ['project_id', 'sdk.name', 'count()'],
      projects: selectedProjectIds,
      query: `has:sdk.name !sdk.name:[${compatibleSDKNames.join(',')}]`,

      name: '',
      version: 2,
    },
    selection
  );
}

type PlatformCompatibilityCheckerProps = {
  children: React.ReactNode;
  compatibleSDKNames: string[];
  docsUrl: string;
};

// Checks if the currently selected platforms are compatible with the current view
// and if there are incompatible projects, list them in a warning message.
// If there are no compatible platforms, only return the alert, otherwise return the children
// after setting the alert.
export function PlatformCompatibilityChecker({
  compatibleSDKNames,
  children,
  docsUrl,
}: PlatformCompatibilityCheckerProps) {
  const location = useLocation();
  const organization = useOrganization();
  const {selection, isReady} = usePageFilters();
  const {projects} = useProjects();
  const {pageAlert, setPageWarning} = usePageAlert();
  const {projects: selectedProjectIds} = selection;

  // Get the projects that are incompatible with the current view
  const {data, isLoading} = useDiscoverQuery({
    eventView: getEventView(selection, compatibleSDKNames),
    location,
    orgSlug: organization.slug,
    referrer: 'api.starfish-mobile-platform-compatibility',
    options: {
      enabled: isReady,
    },
  });

  const incompatibleProjects = useMemo(() => {
    const incompatibleProjectIds = new Set(data?.data.map(row => row.project_id));

    // My Projects and All Projects are represented by an empty selection
    // or -1. Don't filter in these cases
    const selectedProjects =
      selectedProjectIds.length === 0 || selectedProjectIds[0] === -1
        ? projects
        : projects.filter(project =>
            selectedProjectIds.includes(parseInt(project.id, 10))
          );

    return selectedProjects.filter(project =>
      incompatibleProjectIds.has(parseInt(project.id, 10))
    );
  }, [data?.data, projects, selectedProjectIds]);
  const prevIncompatibleProjects = usePrevious(incompatibleProjects);

  useEffect(() => {
    if (incompatibleProjects.length > 0) {
      if (incompatibleProjects !== prevIncompatibleProjects) {
        const listedIncompatibleProjects = incompatibleProjects
          .slice(0, MAX_PROJECTS_TO_LIST)
          .map(project => project.slug)
          .join(', ');
        setPageWarning(
          tct(
            'The following selected projects contain data from SDKs that are not supported by this view: [projects]. The currently supported SDK platforms are: [platforms]. We recommend to filter your current project selection to the supported platforms, to learn more, [link:read the docs].',
            {
              projects:
                incompatibleProjects.length <= MAX_PROJECTS_TO_LIST
                  ? listedIncompatibleProjects
                  : tct('[projects], and [count] more', {
                      projects: listedIncompatibleProjects,
                      count: incompatibleProjects.length - MAX_PROJECTS_TO_LIST,
                    }),
              platforms: compatibleSDKNames.join(', '),
              link: <ExternalLink href={docsUrl}>{t('read the docs')}</ExternalLink>,
            }
          )
        );
      }
    } else if (incompatibleProjects.length === 0 && pageAlert?.message) {
      setPageWarning(undefined);
    }
  }, [
    compatibleSDKNames,
    docsUrl,
    incompatibleProjects,
    pageAlert,
    prevIncompatibleProjects,
    setPageWarning,
  ]);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (
    incompatibleProjects.length > 0 &&
    incompatibleProjects.length === selectedProjectIds.length
  ) {
    // Don't return anything if all projects are incompatible
    return null;
  }

  return children;
}
