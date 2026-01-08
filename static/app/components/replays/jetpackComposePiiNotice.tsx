import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {MIN_JETPACK_COMPOSE_VIEW_HIERARCHY_PII_FIX} from 'sentry/utils/replays/sdkVersions';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import {semverCompare} from 'sentry/utils/versions/semverCompare';
import type {ReplayListRecord} from 'sentry/views/replays/types';

export function JetpackComposePiiNotice() {
  const LOCAL_STORAGE_KEY = 'jetpack-compose-pii-warning-dismissed';
  const {dismiss, isDismissed} = useDismissAlert({key: LOCAL_STORAGE_KEY});

  if (isDismissed) {
    return null;
  }

  return (
    <Alert.Container>
      <Alert
        variant="danger"
        trailingItems={
          <Button
            aria-label={t('Dismiss')}
            icon={<IconClose />}
            onClick={dismiss}
            size="zero"
            borderless
          />
        }
      >
        {tct(
          'There is a [advisory:known PII/masking issue] with [jetpack:Jetpack Compose versions 1.8 and above]. [link:Update your Sentry SDK to version 8.14.0 or later] to ensure replays are properly masked.',
          {
            jetpack: <strong />,
            advisory: (
              <ExternalLink href="https://github.com/getsentry/sentry-java/security/advisories/GHSA-7cjh-xx4r-qh3f" />
            ),
            link: (
              <ExternalLink
                href={MIN_JETPACK_COMPOSE_VIEW_HIERARCHY_PII_FIX.releaseNotes}
              />
            ),
          }
        )}
      </Alert>
    </Alert.Container>
  );
}

export function useNeedsJetpackComposePiiNotice({
  replays,
}: {
  replays: ReplayListRecord[];
}) {
  const needsJetpackComposePiiWarning = replays.find(replay => {
    return (
      replay.sdk.name === 'sentry.java.android' &&
      semverCompare(
        replay.sdk.version ?? '',
        MIN_JETPACK_COMPOSE_VIEW_HIERARCHY_PII_FIX.minVersion
      ) === -1
    );
  });
  return needsJetpackComposePiiWarning;
}
