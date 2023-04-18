import {useMemo} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {IconClose, IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project, ProjectSdkUpdates} from 'sentry/types';
import {semverCompare} from 'sentry/utils/profiling/units/versions';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useProjectSdkUpdates} from 'sentry/utils/useProjectSdkUpdates';

const MIN_REPLAY_CLICK_SDK = '7.44.0';
const LOCAL_STORAGE_KEY = 'replay-player-min-sdk-alert-dismissed';

// exported for testing
export function ReplaySearchAlert() {
  const {selection} = usePageFilters();
  const projects = useProjects();
  const location = useLocation();
  const organization = useOrganization();
  const sdkUpdates = useProjectSdkUpdates({
    organization,
    projectId: null,
  });

  const {dismiss: handleDismiss, isDismissed} = useDismissAlert({
    key: LOCAL_STORAGE_KEY,
  });
  const conditions = useMemo(() => {
    return new MutableSearch(decodeScalar(location.query.query, ''));
  }, [location.query.query]);

  const hasReplayClick = conditions.getFilterKeys().some(k => k.startsWith('click.'));

  if (sdkUpdates.type !== 'resolved') {
    return null;
  }

  const selectedProjectsWithSdkUpdates = sdkUpdates.data?.reduce((acc, sdkUpdate) => {
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

  if (hasReplayClick) {
    return (
      <Alert data-test-id="min-sdk-alert">
        <AlertContent>
          <IconInfo />
          <AlertText>
            {tct(
              'Search field [click] requires a minimum SDK version of >= [minSdkVersion].',
              {
                click: <strong>'click'</strong>,
                minSdkVersion: <strong>{MIN_REPLAY_CLICK_SDK}</strong>,
              }
            )}
          </AlertText>
        </AlertContent>
      </Alert>
    );
  }

  if (isDismissed) {
    return null;
  }

  return (
    <Alert data-test-id="min-sdk-alert">
      <AlertContent>
        <IconInfo />
        <AlertText>
          {tct(
            'Search for dom elements clicked during a replay by using our new search key [click]. Sadly, it requires an SDK version >= [version]',
            {
              click: <strong>{`'click'`}</strong>,
              version: <strong>{MIN_REPLAY_CLICK_SDK}</strong>,
            }
          )}
        </AlertText>
        <Button
          priority="link"
          size="sm"
          icon={<IconClose size="xs" />}
          aria-label={t('Close Alert')}
          onClick={handleDismiss}
        />
      </AlertContent>
    </Alert>
  );
}

const AlertContent = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
`;

const AlertText = styled('div')`
  flex-grow: 1;
`;
