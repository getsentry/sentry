import {useEffect} from 'react';
import styled from '@emotion/styled';

import replaysDeadRageBackground from 'sentry-images/spot/replay-dead-rage-changelog.svg';

import {LinkButton} from 'sentry/components/button';
import PageBanner from 'sentry/components/replays/pageBanner';
import {IconBroadcast} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {MIN_DEAD_RAGE_CLICK_SDK} from 'sentry/utils/replays/sdkVersions';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';

export default function ReplayRageClickSdkVersionBanner() {
  const organization = useOrganization();

  const {dismiss, isDismissed} = useDismissAlert({
    key: `${organization.id}:replay-rage-dead-click-sdk-version-banner-v1`,
  });

  const routes = useRoutes();
  const surface = getRouteStringFromRoutes(routes);

  useEffect(() => {
    trackAnalytics('replay.rage-click-sdk-banner.rendered', {
      is_dismissed: isDismissed,
      organization,
      surface,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Don't log immediatly after the banner is dismissed. On each pageload/mount is fine.

  if (isDismissed) {
    return null;
  }

  return (
    <PageBanner
      button={
        <LinkButton
          analyticsEventKey="replay.rage-click-sdk-banner.viewed_changelog"
          analyticsEventName="Replay Rage Click SDK Banner Viewed Changelog"
          analyticsParams={{surface}}
          external
          href={MIN_DEAD_RAGE_CLICK_SDK.changelog}
          priority="primary"
        >
          {t('Read Changelog')}
        </LinkButton>
      }
      description={t(
        "Understand what your users do when your user experience doesn't meet their expectations"
      )}
      heading={t('Introducing Rage and Dead Clicks')}
      icon={<IconBroadcast size="sm" />}
      image={replaysDeadRageBackground}
      onDismiss={() => {
        trackAnalytics('replay.rage-click-sdk-banner.dismissed', {
          organization,
          surface,
        });
        dismiss();
      }}
      title={tct("What's new in [version]", {
        version: (
          <PurpleText>
            {tct(`version [version_number]`, {
              version_number: MIN_DEAD_RAGE_CLICK_SDK.minVersion,
            })}
          </PurpleText>
        ),
      })}
    />
  );
}

const PurpleText = styled('strong')`
  color: ${p => p.theme.purple400};
`;
