import {Fragment} from 'react';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';

type Props = ModalRenderProps & {
  featureName: string;
  features: string | string[];
  message?: string;
};

export function FeatureDisabledModal({
  Body,
  Footer,
  closeModal,
  CloseButton,
  features,
  featureName,
  message,
}: Props) {
  return (
    <Fragment>
      <CloseButton onClick={closeModal} />
      <Body>
        <FeatureDisabled
          featureName={featureName}
          features={features}
          message={message}
          alert={false}
          hideHelpToggle
        />
      </Body>
      <Footer>
        <Button priority="primary" onClick={closeModal}>
          {t('Got it')}
        </Button>
      </Footer>
    </Fragment>
  );
}
