import {Fragment} from 'react';
import styled from '@emotion/styled';

import ReplayRageClickSdkVersionBanner from 'sentry/components/replays/replayRageClickSdkVersionBanner';
import {space} from 'sentry/styles/space';
import {useHaveSelectedProjectsSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import {MIN_DEAD_RAGE_CLICK_SDK} from 'sentry/utils/replays/sdkVersions';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';
import DeadRageSelectorCards from 'sentry/views/replays/deadRageClick/deadRageSelectorCards';
import ReplaysFilters from 'sentry/views/replays/list/filters';
import ReplayOnboardingPanel from 'sentry/views/replays/list/replayOnboardingPanel';
import ReplaysErroneousDeadRageCards from 'sentry/views/replays/list/replaysErroneousDeadRageCards';
import ReplaysList from 'sentry/views/replays/list/replaysList';
import ReplaysSearch from 'sentry/views/replays/list/search';

export default function ListContent() {
  const organization = useOrganization();
  const hasSessionReplay = organization.features.includes('session-replay');
  const hasSentReplays = useHaveSelectedProjectsSentAnyReplayEvents();
  const hasdeadRageClickFeature = organization.features.includes(
    'session-replay-rage-dead-selectors'
  );

  const {
    selection: {projects},
  } = usePageFilters();
  const rageClicksSdkVersion = useProjectSdkNeedsUpdate({
    minVersion: MIN_DEAD_RAGE_CLICK_SDK.minVersion,
    organization,
    projectId: projects.map(String),
  });

  useRouteAnalyticsParams({
    hasSessionReplay,
    hasSentReplays: hasSentReplays.hasSentOneReplay,
    hasRageClickMinSDK: !rageClicksSdkVersion.needsUpdate,
  });

  if (hasSentReplays.fetching || rageClicksSdkVersion.isFetching) {
    return null;
  }

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

  if (rageClicksSdkVersion.needsUpdate) {
    return (
      <Fragment>
        <FiltersContainer>
          <ReplaysFilters />
          <ReplaysSearch />
        </FiltersContainer>
        <ReplayRageClickSdkVersionBanner />
        <ReplaysList />
      </Fragment>
    );
  }

  return (
    <Fragment>
      <FiltersContainer>
        <ReplaysFilters />
        <ReplaysSearch />
      </FiltersContainer>
      {hasdeadRageClickFeature ? (
        <DeadRageSelectorCards />
      ) : (
        <ReplaysErroneousDeadRageCards />
      )}
      <ReplaysList />
    </Fragment>
  );
}

const FiltersContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(2)};
`;
