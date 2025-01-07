import {ClassNames} from '@emotion/react';

import {Button} from 'sentry/components/button';
import {Hovercard} from 'sentry/components/hovercard';
import {ButtonContainer, Resource} from 'sentry/components/replays/configureReplayCard';
import {IconQuestion} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ReplayRecord} from 'sentry/views/replays/types';

function getSDKName(sdkName: string | null | undefined) {
  switch (sdkName) {
    case 'sentry.cocoa':
      return 'apple/guides/ios';
    case 'sentry.java.android':
      return 'android';
    case 'sentry.dart.flutter':
      return 'flutter';
    case 'sentry.javascript.react-native':
    default:
      return 'react-native';
  }
}

function ResourceButtons({sdkName}: {sdkName: string}) {
  return (
    <ButtonContainer>
      <Resource
        title={t('General')}
        subtitle={t('Configure sampling rates and recording thresholds')}
        link={`https://docs.sentry.io/platforms/${sdkName}/session-replay/#sampling`}
      />
      <Resource
        title={t('Element Masking/Blocking')}
        subtitle={t('Unmask text (****) and unblock media (img, svg, video, etc.)')}
        link={`https://docs.sentry.io/platforms/${sdkName}/session-replay/#privacy`}
      />
      <Resource
        title={t('Identify Users')}
        subtitle={t('Identify your users through a specific attribute, such as email.')}
        link={`https://docs.sentry.io/platforms/${sdkName}/enriching-events/identify-user/`}
      />
    </ButtonContainer>
  );
}

export default function ConfigureMobileReplayCard({
  replayRecord,
}: {
  replayRecord: ReplayRecord | undefined;
}) {
  const sdkName = getSDKName(replayRecord?.sdk.name);

  return (
    <ClassNames>
      {({css}) => (
        <Hovercard
          body={<ResourceButtons sdkName={sdkName} />}
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
