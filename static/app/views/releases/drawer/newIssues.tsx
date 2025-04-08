import GroupList from 'sentry/components/issues/groupList';
import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {IssueSortOptions} from 'sentry/views/issueList/utils';
import {EmptyState} from 'sentry/views/releases/detail/commitsAndFiles/emptyState';
import {getReleaseBounds, getReleaseParams} from 'sentry/views/releases/utils';
import {useReleaseDetails} from 'sentry/views/releases/utils/useReleaseDetails';

interface Props {
  projectId: string;
  release: string;
  withChart?: boolean;
}

export function NewIssues({release, projectId, withChart = false}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const {data: releaseDetails} = useReleaseDetails({release});
  let queryFilterDescription;
  const path = `/organizations/${organization.slug}/issues/`;
  const queryParams = {
    ...getReleaseParams({
      location,
      releaseBounds: getReleaseBounds(releaseDetails),
    }),
    project: projectId,
    limit: 10,
    sort: IssueSortOptions.FREQ,
    groupStatsPeriod: 'auto',
    query: new MutableSearch([
      `first-release:${release}`,
      'is:unresolved',
    ]).formatString(),
  };

  const renderEmptyMessage = () => {
    return <EmptyState>{t('No new issues in this release.')}</EmptyState>;
  };

  return (
    <GroupList
      endpointPath={path}
      queryParams={queryParams}
      query={`release:${releaseDetails?.versionInfo.version.raw}`}
      canSelectGroups={false}
      queryFilterDescription={queryFilterDescription}
      withChart={withChart}
      renderEmptyMessage={renderEmptyMessage}
      withPagination={false}
      // onFetchSuccess={}
      source="release-drawer"
    />
  );
}
