import {ComponentProps, useMemo} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {LinkButton} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Placeholder from 'sentry/components/placeholder';
import {Flex} from 'sentry/components/profiling/flex';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import {IconDelete, IconPlay} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';
import {useRoutes} from 'sentry/utils/useRoutes';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

type Props = {
  eventTimestampMs: number;
  orgSlug: string;
  replaySlug: string;
  buttonProps?: Partial<ComponentProps<typeof LinkButton>>;
  fromFeedback?: boolean;
};

function ReplayPreview({
  orgSlug,
  replaySlug,
  eventTimestampMs,
  buttonProps,
  fromFeedback,
}: Props) {
  const routes = useRoutes();
  const {fetching, replay, replayRecord, fetchError, replayId} = useReplayReader({
    orgSlug,
    replaySlug,
  });

  const startTimestampMs = replayRecord?.started_at?.getTime() ?? 0;
  const initialTimeOffsetMs = useMemo(() => {
    if (eventTimestampMs && startTimestampMs) {
      return Math.abs(eventTimestampMs - startTimestampMs);
    }

    return 0;
  }, [eventTimestampMs, startTimestampMs]);

  if (replayRecord?.is_archived) {
    return (
      <Alert type="warning" data-test-id="replay-error">
        <Flex gap={space(0.5)}>
          <IconDelete color="gray500" size="sm" />
          {t('The replay for this event has been deleted.')}
        </Flex>
      </Alert>
    );
  }

  if (fetchError) {
    const reasons = [
      tct(
        'The replay was rate-limited and could not be accepted. [link:View the stats page] for more information.',
        {
          link: <Link to={`/organizations/${orgSlug}/stats/?dataCategory=replays`} />,
        }
      ),
      t('The replay has been deleted by a member in your organization.'),
      t('There were network errors and the replay was not saved.'),
      tct('[link:Read the docs] to understand why.', {
        link: (
          <ExternalLink href="https://docs.sentry.io/platforms/javascript/session-replay/#error-linking" />
        ),
      }),
    ];

    return (
      <Alert
        type="info"
        showIcon
        data-test-id="replay-error"
        trailingItems={
          <LinkButton
            external
            href="https://docs.sentry.io/platforms/javascript/session-replay/#error-linking"
            size="xs"
          >
            {t('Read Docs')}
          </LinkButton>
        }
      >
        <p>
          {t(
            'The replay for this event cannot be found. This could be due to these reasons:'
          )}
        </p>
        <List symbol="bullet">
          {reasons.map((reason, i) => (
            <ListItem key={i}>{reason}</ListItem>
          ))}
        </List>
      </Alert>
    );
  }

  if (fetching || !replayRecord) {
    return (
      <StyledPlaceholder
        testId="replay-loading-placeholder"
        height="400px"
        width="100%"
      />
    );
  }

  const fullReplayUrlErrors = {
    pathname: normalizeUrl(`/organizations/${orgSlug}/replays/${replayId}/`),
    query: {
      referrer: getRouteStringFromRoutes(routes),
      t_main: TabKey.ERRORS,
      t: initialTimeOffsetMs / 1000,
    },
  };

  const fullReplayUrlBreadcrumbs = {
    pathname: normalizeUrl(`/organizations/${orgSlug}/replays/${replayId}/`),
    query: {
      referrer: getRouteStringFromRoutes(routes),
      t_main: TabKey.BREADCRUMBS,
      t: initialTimeOffsetMs / 1000,
    },
  };

  return (
    <ReplayContextProvider
      isFetching={fetching}
      replay={replay}
      initialTimeOffsetMs={{offsetMs: initialTimeOffsetMs}}
    >
      <PlayerContainer data-test-id="player-container">
        <StaticPanel>
          <ReplayPlayer isPreview />
        </StaticPanel>
        <CTAOverlay>
          <LinkButton
            {...buttonProps}
            icon={<IconPlay />}
            priority="primary"
            to={fromFeedback ? fullReplayUrlBreadcrumbs : fullReplayUrlErrors}
          >
            {t('Open Replay')}
          </LinkButton>
        </CTAOverlay>
      </PlayerContainer>
    </ReplayContextProvider>
  );
}

const PlayerContainer = styled(FluidHeight)`
  position: relative;
  background: ${p => p.theme.background};
  gap: ${space(1)};
  max-height: 448px;
`;

const StaticPanel = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const CTAOverlay = styled('div')`
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(255, 255, 255, 0.5);
`;

const StyledPlaceholder = styled(Placeholder)`
  margin-bottom: ${space(2)};
`;

export default ReplayPreview;
