import {Fragment} from 'react';
import invariant from 'invariant';

import {Flex, Stack} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {FullViewport} from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import {
  ReplayAccess,
  ReplayAccessFallbackAlert,
} from 'sentry/components/replays/replayAccess';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLoadReplayReader} from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {useReplayPageview} from 'sentry/utils/replays/hooks/useReplayPageview';
import {useRouteAnalyticsEventNames} from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import {useRouteAnalyticsParams} from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useUser} from 'sentry/utils/useUser';
import {ReplayDetailsProviders} from 'sentry/views/explore/replays/detail/body/replayDetailsProviders';
import {ReplayDetailsHeaderActions} from 'sentry/views/explore/replays/detail/header/replayDetailsHeaderActions';
import {ReplayDetailsMetadata} from 'sentry/views/explore/replays/detail/header/replayDetailsMetadata';
import {ReplayDetailsPageBreadcrumbs} from 'sentry/views/explore/replays/detail/header/replayDetailsPageBreadcrumbs';
import {ReplayDetailsUserBadge} from 'sentry/views/explore/replays/detail/header/replayDetailsUserBadge';
import {ReplayDetailsPage} from 'sentry/views/explore/replays/detail/page';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

export default function ReplayDetails() {
  const hasPageFrame = useHasPageFrameFeature();

  return (
    <AnalyticsArea name="details">
      <ReplayAccess
        fallback={
          <Fragment>
            <Flex
              borderBottom="secondary"
              justify="between"
              align="center"
              gap="md"
              wrap="wrap"
              padding={hasPageFrame ? {sm: 'sm lg', md: 'md xl'} : 'sm lg'}
            >
              {t('Replay Details')}
            </Flex>
            <Layout.Body>
              <ReplayAccessFallbackAlert />
            </Layout.Body>
          </Fragment>
        }
      >
        <ReplayDetailsContent />
      </ReplayAccess>
    </AnalyticsArea>
  );
}

function ReplayDetailsContent() {
  const user = useUser();
  const location = useLocation();
  const organization = useOrganization();
  const {replaySlug} = useParams();
  invariant(replaySlug, '`replaySlug` is required as part of the route params');

  const {slug: orgSlug} = organization;

  // TODO: replayId is known ahead of time and useReplayData is parsing it from the replaySlug
  // once we fix the route params and links we should fix this to accept replayId and stop returning it
  const readerResult = useLoadReplayReader({
    replaySlug,
    orgSlug,
  });
  const {replay, replayRecord} = readerResult;

  useReplayPageview('replay.details-time-spent');
  useRouteAnalyticsEventNames('replay_details.viewed', 'Replay Details: Viewed');
  useRouteAnalyticsParams({
    organization,
    referrer: decodeScalar(location.query.referrer),
    user_email: user.email,
    tab: location.query.t_main,
    mobile: replay?.isVideoReplay(),
  });

  const title = replayRecord
    ? `${replayRecord.user.display_name ?? t('Anonymous User')} — Session Replay — ${orgSlug}`
    : `Session Replay — ${orgSlug}`;

  const hasPageFrame = useHasPageFrameFeature();

  if (hasPageFrame) {
    const pageFrameContent = (
      <Fragment>
        <TopBar.Slot name="title">
          <ReplayDetailsPageBreadcrumbs readerResult={readerResult} />
        </TopBar.Slot>
        <ReplayDetailsHeaderActions readerResult={readerResult} />
        <Flex
          justify="between"
          align="center"
          gap="md"
          wrap="wrap"
          padding={{sm: 'md lg', md: 'md xl'}}
          borderBottom="secondary"
        >
          <ReplayDetailsUserBadge readerResult={readerResult} />
          <ReplayDetailsMetadata readerResult={readerResult} />
        </Flex>
        <Stack flex={1} minHeight="0" overflow="hidden" padding="lg xl">
          <ReplayDetailsPage readerResult={readerResult} />
        </Stack>
      </Fragment>
    );

    return (
      <SentryDocumentTitle title={title}>
        <Stack flex={1} height="100%" minHeight="0" width="100%" overflow="hidden">
          {replay ? (
            <ReplayDetailsProviders
              replay={replay}
              projectSlug={readerResult.projectSlug}
            >
              {pageFrameContent}
            </ReplayDetailsProviders>
          ) : (
            pageFrameContent
          )}
        </Stack>
      </SentryDocumentTitle>
    );
  }

  const legacyContent = (
    <Fragment>
      <Flex direction="column">
        <Flex
          borderBottom="secondary"
          justify="between"
          align="center"
          gap="md"
          wrap="wrap"
          padding="sm lg"
        >
          <ReplayDetailsPageBreadcrumbs readerResult={readerResult} />
          <ReplayDetailsHeaderActions readerResult={readerResult} />
        </Flex>
        <Flex justify="between" align="center" padding="md lg" borderBottom="secondary">
          <ReplayDetailsUserBadge readerResult={readerResult} />
          <ReplayDetailsMetadata readerResult={readerResult} />
        </Flex>
      </Flex>
      <ReplayDetailsPage readerResult={readerResult} />
    </Fragment>
  );

  return (
    <SentryDocumentTitle title={title}>
      <Stack flex={1}>
        <FullViewport>
          {replay ? (
            <ReplayDetailsProviders
              replay={replay}
              projectSlug={readerResult.projectSlug}
            >
              {legacyContent}
            </ReplayDetailsProviders>
          ) : (
            legacyContent
          )}
        </FullViewport>
      </Stack>
    </SentryDocumentTitle>
  );
}
