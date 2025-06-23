import {Alert} from 'sentry/components/core/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';
import {MIN_JETPACK_COMPOSE_VIEW_HIERARCHY_PII_FIX} from 'sentry/utils/replays/sdkVersions';
import {semverCompare} from 'sentry/utils/versions/semverCompare';
import type {ReplayListRecord} from 'sentry/views/replays/types';

export function JetpackComposePiiNotice() {
  return (
    <Alert.Container>
      <Alert type="error" showIcon>
        {tct(
          'There is a [advisory:known PII/masking issue] with [jetpack:Jetpack Compose versions 1.8 and above]. [link:Update your Sentry SDK to version 8.14.0 or later] to ensure replays are properly masked.',
          {
            jetpack: <strong />,
            advisory: (
              <ExternalLink href="https://github.com/getsentry/sentry-java/security/advisories/GHSA-7cjh-xx4r-qh3f" />
            ),
            link: (
              <ExternalLink href={MIN_JETPACK_COMPOSE_VIEW_HIERARCHY_PII_FIX.changelog} />
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
  replays: undefined | ReplayListRecord[];
}) {
  const needsJetpackComposePiiWarning = replays?.find(replay => {
    return (
      replay?.sdk.name === 'sentry.java.android' &&
      semverCompare(
        replay?.sdk.version ?? '',
        MIN_JETPACK_COMPOSE_VIEW_HIERARCHY_PII_FIX.minVersion
      ) === -1
    );
  });
  return needsJetpackComposePiiWarning;
}
