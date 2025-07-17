import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useHaveSelectedProjectsSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import {MIN_DEAD_RAGE_CLICK_SDK} from 'sentry/utils/replays/sdkVersions';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';
import DeadRageSelectorCards from 'sentry/views/replays/deadRageClick/deadRageSelectorCards';
import useAllMobileProj from 'sentry/views/replays/detail/useAllMobileProj';
import BulkDeleteAlert from 'sentry/views/replays/list/bulkDeleteAlert';
import ReplaysFilters from 'sentry/views/replays/list/filters';
import ReplayOnboardingPanel from 'sentry/views/replays/list/replayOnboardingPanel';
import ReplaysSearch from 'sentry/views/replays/list/search';
import ReplayIndexTable from 'sentry/views/replays/table/replayIndexTable';

export default function ListContent() {
  const organization = useOrganization();
  const hasSessionReplay = organization.features.includes('session-replay');
  const hasSentReplays = useHaveSelectedProjectsSentAnyReplayEvents();

  const {
    selection: {projects},
  } = usePageFilters();
  const rageClicksSdkVersion = useProjectSdkNeedsUpdate({
    minVersion: MIN_DEAD_RAGE_CLICK_SDK.minVersion,
    organization,
    projectId: projects.map(String),
  });

  const {allMobileProj} = useAllMobileProj({replayPlatforms: true});
  const [widgetIsOpen, setWidgetIsOpen] = useLocalStorageState(
    `replay-dead-rage-widget-open`,
    true
  );

  const isLoading = hasSentReplays.fetching || rageClicksSdkVersion.isFetching;
  const showDeadRageClickCards =
    !rageClicksSdkVersion.needsUpdate && !allMobileProj && !isLoading;

  useRouteAnalyticsParams({
    hasSessionReplay,
    hasSentReplays: hasSentReplays.hasSentOneReplay,
    hasRageClickMinSDK: !rageClicksSdkVersion.needsUpdate,
  });

  // show onboarding
  if (!hasSessionReplay || !hasSentReplays.hasSentOneReplay) {
    return (
      <Fragment>
        <FiltersContainer>
          <ReplaysFilters />
          <ReplaysSearch />
        </FiltersContainer>
        <ReplayOnboardingPanel />
      </Fragment>
    );
  }

  return (
    <Fragment>
      {projects.length === 1 ? (
        <BulkDeleteAlert projectId={String(projects[0] ?? '')} />
      ) : null}
      <FiltersContainer>
        <ReplaysFilters />
        <SearchWrapper>
          <ReplaysSearch />
          {showDeadRageClickCards && (
            <Button onClick={() => setWidgetIsOpen(!widgetIsOpen)}>
              {widgetIsOpen ? t('Hide Widgets') : t('Show Widgets')}
            </Button>
          )}
        </SearchWrapper>
      </FiltersContainer>
      {widgetIsOpen && showDeadRageClickCards ? <DeadRageSelectorCards /> : null}
      {isLoading ? <LoadingIndicator /> : <ReplayIndexTable />}
    </Fragment>
  );
}

const FiltersContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(2)};
  flex-wrap: wrap;
`;

const SearchWrapper = styled(FiltersContainer)`
  flex: 1;
  min-width: 0;
  flex-wrap: nowrap;
`;
