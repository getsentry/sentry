import {Fragment} from 'react';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';

type Props = ModalRenderProps & {};

export function SendDataThirdPartyModal({
  Header,
  Body,
  Footer,
  closeModal,
  organization,
  recommendedSdkUpgrades,
  onGoBack,
  onReadDocs,
  onSubmit,
  clientSampleRate,
  serverSampleRate,
  uniformRule,
  projectId,
  specifiedClientRate,
  recommendedSampleRate,
  onSetRules,
}: Props) {
  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Data Processing Agreement')}</h4>
      </Header>
      <Body>
        {t(
          'By using this feature, you agree that OpenAI is a subprocessor and may process the data that you’ve chosen to submit. Sentry makes no guarantees as to the accuracy of the feature’s AI-generated recommendations.'
        )}
      </Body>
      <Footer>Blah</Footer>
    </Fragment>
  );
}
