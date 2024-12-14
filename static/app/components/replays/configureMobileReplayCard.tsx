import {ClassNames} from '@emotion/react';

import {Button} from 'sentry/components/button';
import {Hovercard} from 'sentry/components/hovercard';
import {ButtonContainer, Resource} from 'sentry/components/replays/configureReplayCard';
import {IconQuestion} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

function ResourceButtons() {
  return (
    <ButtonContainer>
      <Resource
        title={t('General')}
        subtitle={t('Configure sampling rates and recording thresholds')}
        link="https://docs.sentry.io/platforms/android/session-replay/#sampling"
      />
      <Resource
        title={t('Element Masking/Blocking')}
        subtitle={t('Unmask text (****) and unblock media (img, svg, video, etc.)')}
        link="https://docs.sentry.io/platforms/android/session-replay/#privacy"
      />
    </ButtonContainer>
  );
}

export default function ConfigureMobileReplayCard() {
  return (
    <ClassNames>
      {({css}) => (
        <Hovercard
          body={<ResourceButtons />}
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
