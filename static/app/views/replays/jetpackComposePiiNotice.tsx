import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MIN_JETPACK_COMPOSE_VIEW_HIERARCHY_PII_FIX} from 'sentry/utils/replays/sdkVersions';

export function JetpackComposePiiNotice() {
  return (
    <AndroidSdkWarningContainer>
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
    </AndroidSdkWarningContainer>
  );
}

const AndroidSdkWarningContainer = styled('div')`
  margin-bottom: ${space(2)};
`;
