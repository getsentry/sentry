import {useMemo} from 'react';

import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';
import type {Project, ProjectSdkUpdates, UpdateSdkSuggestion} from 'sentry/types';
import {semverCompare} from 'sentry/utils/profiling/units/versions';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import withSdkUpdates from 'sentry/utils/withSdkUpdates';

interface ReplaySearchAlertProps {
  sdkUpdates?: ProjectSdkUpdates[] | null;
}

const MIN_REPLAY_CLICK_SDK = '7.44.0';

export const ReplaySearchAlert = withSdkUpdates(function ReplayTableAlert({
  sdkUpdates,
}: ReplaySearchAlertProps) {
  const {selection} = usePageFilters();
  const projects = useProjects();
  const location = useLocation();
  const conditions = useMemo(() => {
    return new MutableSearch(decodeScalar(location.query.query, ''));
  }, [location.query]);

  const hasReplayClick = conditions.getFilterKeys().some(k => k.includes('click'));

  if (!hasReplayClick) {
    return null;
  }

  const selectedProjectsWithSdkUpdates = sdkUpdates?.reduce((acc, sdkUpdate) => {
    if (!selection.projects.includes(Number(sdkUpdate.projectId))) {
      return acc;
    }

    const project = projects.projects.find(p => p.id === sdkUpdate.projectId);
    // should never really happen but making ts happy
    if (!project) {
      return acc;
    }

    acc.push({
      project,
      sdkUpdate,
    });

    return acc;
  }, [] as Array<{project: Project; sdkUpdate: ProjectSdkUpdates}>);

  const doesNotMeetMinSDK =
    selectedProjectsWithSdkUpdates &&
    selectedProjectsWithSdkUpdates.length > 0 &&
    selectedProjectsWithSdkUpdates.every(({sdkUpdate}) => {
      return semverCompare(sdkUpdate.sdkVersion, MIN_REPLAY_CLICK_SDK) === -1;
    });

  if (!doesNotMeetMinSDK) {
    return null;
  }

  const sdkUpdateAction = selectedProjectsWithSdkUpdates?.[0]?.sdkUpdate.suggestions.find(
    suggestion => suggestion.type === 'updateSdk'
  ) as UpdateSdkSuggestion | undefined;

  if (sdkUpdateAction) {
    return (
      <Alert>
        {tct(
          'Searching by click requires a minimum SDK version of [sdkName]@v[minSdkVersion]. [action]',
          {
            sdkName: sdkUpdateAction.sdkName,
            newSdkVersion: sdkUpdateAction.newSdkVersion,
            minSdkVersion: MIN_REPLAY_CLICK_SDK,
            action: sdkUpdateAction.sdkUrl ? (
              <ExternalLink href={sdkUpdateAction.sdkUrl}>
                {tct('Update to [sdkName]@v[newSdkVersion]', {
                  sdkName: sdkUpdateAction.sdkName,
                  newSdkVersion: sdkUpdateAction.newSdkVersion,
                })}
              </ExternalLink>
            ) : (
              tct('Update to [sdkName]@v[newSdkVersion]', {
                sdkName: sdkUpdateAction.sdkName,
                newSdkVersion: sdkUpdateAction.newSdkVersion,
              })
            ),
          }
        )}
      </Alert>
    );
  }

  return (
    <Alert>
      {tct('Searching by click requires a minimum SDK version of v[minSdkVersion].', {
        minSdkVersion: MIN_REPLAY_CLICK_SDK,
      })}
    </Alert>
  );
});
