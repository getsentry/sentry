import styled from '@emotion/styled';

import replaysDeadRageBackground from 'sentry-images/spot/replay-dead-rage-changelog.svg';

import {Button} from 'sentry/components/button';
import PageBanner from 'sentry/components/replays/pageBanner';
import {IconBroadcast} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {MIN_DEAD_RAGE_CLICK_SDK} from 'sentry/utils/replays/sdkVersions';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import useOrganization from 'sentry/utils/useOrganization';

export default function ReplayRageClickSdkVersionBanner() {
  const organization = useOrganization();

  const {dismiss, isDismissed} = useDismissAlert({
    key: `${organization.id}:replay-rage-dead-click-sdk-version-banner-v1`,
  });

  if (isDismissed) {
    return null;
  }

  return (
    <PageBanner
      button={<Button priority="primary">Read Changelog</Button>}
      description={t(
        "Understand what your users do when your user experience doesn't meet their expectations"
      )}
      heading={t('Introducing Rage and Dead Clicks')}
      icon={<IconBroadcast size="sm" />}
      image={replaysDeadRageBackground}
      onDismiss={dismiss}
      title={tct("What's new in [version]", {
        version: (
          <PurpleText>
            {tct(`version [version_number]`, {
              version_number: MIN_DEAD_RAGE_CLICK_SDK,
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
