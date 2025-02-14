import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import ReplayRageClickSdkVersionBanner from 'sentry/components/replays/replayRageClickSdkVersionBanner';
import {IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useHaveSelectedProjectsSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import {MIN_DEAD_RAGE_CLICK_SDK} from 'sentry/utils/replays/sdkVersions';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';
import DeadRageSelectorCards from 'sentry/views/replays/deadRageClick/deadRageSelectorCards';
import useAllMobileProj from 'sentry/views/replays/detail/useAllMobileProj';
import ReplaysFilters from 'sentry/views/replays/list/filters';
import ReplayOnboardingPanel from 'sentry/views/replays/list/replayOnboardingPanel';
import ReplaysList from 'sentry/views/replays/list/replaysList';
import ReplaysSearch from 'sentry/views/replays/list/search';

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
  const mobileBetaOrg = organization.features.includes('mobile-replay-beta-orgs');

  const [widgetIsOpen, setWidgetIsOpen] = useState(true);

  useRouteAnalyticsParams({
    hasSessionReplay,
    hasSentReplays: hasSentReplays.hasSentOneReplay,
    hasRageClickMinSDK: !rageClicksSdkVersion.needsUpdate,
  });

  if (hasSentReplays.fetching || rageClicksSdkVersion.isFetching) {
    return (
      <Fragment>
        <FiltersContainer>
          <ReplaysFilters />
          <ReplaysSearch />
        </FiltersContainer>
        <LoadingIndicator />
      </Fragment>
    );
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

  if (rageClicksSdkVersion.needsUpdate && !allMobileProj) {
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
        <SearchWrapper>
          <ReplaysSearch />
          {!allMobileProj && (
            <Button onClick={() => setWidgetIsOpen(!widgetIsOpen)}>
              {widgetIsOpen ? t('Hide Widgets') : t('Show Widgets')}
            </Button>
          )}
        </SearchWrapper>
      </FiltersContainer>
      {allMobileProj && mobileBetaOrg ? (
        <Alert type="info" icon={<IconInfo />} showIcon>
          {tct(
            `[strong:Mobile Replay is now generally available.] Since your org participated in the beta, you'll have a two month grace period of unlimited usage until March 6. After that, we will only accept replay events that are included in your plan. If you'd like to increase your reserved replay quota, go to your [link:Subscription Settings] or speak to your organization owner.`,
            {
              strong: <strong />,
              link: <Link to={`/settings/${organization.slug}/billing/overview/`} />,
            }
          )}
        </Alert>
      ) : null}
      {widgetIsOpen && !allMobileProj ? <DeadRageSelectorCards /> : null}
      <ReplaysList />
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
  flex-grow: 1;
  flex-wrap: nowrap;
`;
