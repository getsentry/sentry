import {ClassNames} from '@emotion/react';
import * as Sentry from '@sentry/react';

import {Button} from 'sentry/components/button';
import {Hovercard} from 'sentry/components/hovercard';
import {ButtonContainer, Resource} from 'sentry/components/replays/configureReplayCard';
import {IconQuestion} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ReplayRecord} from 'sentry/views/replays/types';

function getPath(sdkName: string | null | undefined) {
  switch (sdkName) {
    case 'sentry.cocoa':
      return 'apple/guides/ios'; // https://docs.sentry.io/platforms/apple/guides/ios/session-replay/
    case 'sentry.java.android':
      return 'android'; // https://docs.sentry.io/platforms/android/session-replay/
    case 'sentry.dart.flutter':
      return 'flutter'; // https://docs.sentry.io/platforms/dart/guides/flutter/session-replay/
    case 'npm:@sentry/react-native':
    case 'sentry.cocoa.react-native':
    case 'sentry.javascript.react-native':
      return 'react-native'; // https://docs.sentry.io/platforms/react-native/session-replay/
    default:
      Sentry.captureMessage(`Unknown mobile platform in configure card: ${sdkName}`);
      return null;
  }
}

function ResourceButtons({path}: {path: string}) {
  return (
    <ButtonContainer>
      <Resource
        title={t('General')}
        subtitle={t('Configure sampling rates and recording thresholds')}
        link={`https://docs.sentry.io/platforms/${path}/session-replay/#sampling`}
      />
      <Resource
        title={t('Element Masking/Blocking')}
        subtitle={t('Unmask text (****) and unblock media (img, svg, video, etc.)')}
        link={`https://docs.sentry.io/platforms/${path}/session-replay/#privacy`}
      />
      <Resource
        title={t('Identify Users')}
        subtitle={t('Identify your users through a specific attribute, such as email.')}
        link={`https://docs.sentry.io/platforms/${path}/enriching-events/identify-user/`}
      />
    </ButtonContainer>
  );
}

export default function ConfigureMobileReplayCard({
  replayRecord,
}: {
  replayRecord: ReplayRecord | undefined;
}) {
  const path = getPath(replayRecord?.sdk.name);

  if (!path) {
    return null;
  }

  return (
    <ClassNames>
      {({css}) => (
        <Hovercard
          body={<ResourceButtons path={path} />}
          bodyClassName={css`
            padding: ${space(1)};
          `}
          position="top-end"
        >
          <Button
            size="sm"
            icon={<IconQuestion />}
            aria-label={t('replay configure resources')}
          >
            {t('Configure Replay')}
          </Button>
        </Hovercard>
      )}
    </ClassNames>
  );
}
