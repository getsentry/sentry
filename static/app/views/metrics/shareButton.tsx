import * as Sentry from '@sentry/react';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import TextCopyInput from 'sentry/components/textCopyInput';
import {IconUpload} from 'sentry/icons';
import {t} from 'sentry/locale';

function ShareModal({Header, Body}) {
  const url = new URL(window.location.href);

  return (
    <div>
      <Header>
        <h3>{t('Share View')}</h3>
      </Header>
      <Body>
        <TextCopyInput aria-label={t('Link to current view')} size="sm">
          {url.toString()}
        </TextCopyInput>
      </Body>
    </div>
  );
}

function ShareButton() {
  return (
    <Button
      size="sm"
      icon={<IconUpload size="sm" />}
      onClick={() => {
        Sentry.metrics.increment('ddm.share');
        openModal(deps => <ShareModal {...deps} />);
      }}
    >
      {t('Share')}
    </Button>
  );
}

export default ShareButton;
