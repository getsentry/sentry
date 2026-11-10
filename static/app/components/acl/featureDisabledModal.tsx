import {Fragment} from 'react';

import {Button} from '@sentry/scraps/button';
import type {ModalRenderProps} from '@sentry/scraps/modal';

import {t} from 'sentry/locale';

import {FeatureDisabled} from './featureDisabled';

type Props = ModalRenderProps & {
  featureName: string;
  features: string | string[];
};

export function FeatureDisabledModal({
  Body,
  Footer,
  closeModal,
  CloseButton,
  features,
  featureName,
}: Props) {
  return (
    <Fragment>
      <CloseButton onClick={closeModal} />
      <Body>
        <FeatureDisabled
          featureName={featureName}
          features={features}
          alert={false}
          hideHelpToggle
        />
      </Body>
      <Footer>
        <Button variant="primary" onClick={closeModal}>
          {t('Got it')}
        </Button>
      </Footer>
    </Fragment>
  );
}
