import {Fragment} from 'react';

import {useHaveSelectedProjectsSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import useOrganization from 'sentry/utils/useOrganization';
import ReplaysFilters from 'sentry/views/replays/list/filters';
import ReplayOnboardingPanel from 'sentry/views/replays/list/replayOnboardingPanel';
import ReplaysErroneousDeadRageCards from 'sentry/views/replays/list/replaysErroneousDeadRageCards';
import ReplaysList from 'sentry/views/replays/list/replaysList';
import ReplaysSearch from 'sentry/views/replays/list/search';

export default function ListContent() {
  const organization = useOrganization();

  const hasSessionReplay = organization.features.includes('session-replay');
  const {hasSentOneReplay, fetching} = useHaveSelectedProjectsSentAnyReplayEvents();
  const showOnboarding = !hasSessionReplay || !hasSentOneReplay;

  return fetching ? null : showOnboarding ? (
    <Fragment>
      <ReplaysFilters>
        <ReplaysSearch />
      </ReplaysFilters>
      <ReplayOnboardingPanel />
    </Fragment>
  ) : (
    <Fragment>
      <ReplaysFilters />
      <ReplaysErroneousDeadRageCards />
      <ReplaysSearch />
      <ReplaysList />
    </Fragment>
  );
}
