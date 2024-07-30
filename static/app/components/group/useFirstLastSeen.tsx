import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useFetchAllEnvsGroupData} from 'sentry/views/issueDetails/groupSidebar';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

export function useFirstLastSeen({group, project}) {
  const organization = useOrganization();
  const environments = useEnvironmentsFromUrl();
  const {data: allEnvironments} = useFetchAllEnvsGroupData(organization, group);
  const hasRelease = project.features.includes('releases');
  const projectSlug = project.slug;
  const projectId = project.id;

  const environment = environments.length > 0 ? environments.join(', ') : undefined;
  const environmentLabel = environment ? environment : t('All Environments');

  const shortEnvironmentLabel =
    environments.length > 1
      ? t('selected environments')
      : environments.length === 1
        ? environments[0]
        : undefined;

  return {
    hasRelease,
    projectSlug,
    projectId,
    environment,
    environmentLabel,
    shortEnvironmentLabel,
    allEnvironments,
  };
}
