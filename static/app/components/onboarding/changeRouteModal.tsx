import {Fragment, useCallback} from 'react';
import {RouteComponentProps} from 'react-router';
import {Location} from 'history';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {} from 'sentry/components/text';
import {t} from 'sentry/locale';
import {usePersistedOnboardingState} from 'sentry/views/onboarding/utils';

type Props = {
  clientState: ReturnType<typeof usePersistedOnboardingState>[0];
  nextLocation: Location;
  router: RouteComponentProps<{}, {}>['router'];
  setClientState: ReturnType<typeof usePersistedOnboardingState>[1];
} & ModalRenderProps;

export const ChangeRouteModal = ({
  Header,
  Body,
  Footer,
  router,
  nextLocation,
  closeModal,
  clientState,
  setClientState,
}: Props) => {
  const handleSetUpLater = useCallback(() => {
    closeModal();

    if (clientState) {
      setClientState({
        ...clientState,
        state: 'skipped',
      });
    }

    router.push({
      ...nextLocation,
      query: nextLocation.query,
    });
  }, [router, nextLocation, closeModal, clientState, setClientState]);

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Are you sure?')}</h4>
      </Header>
      <Body>
        {t(
          'You are about to leave this page without completing the steps required to monitor errors and or performance for this project.'
        )}
      </Body>
      <Footer>
        <ButtonBar gap={1}>
          <Button onClick={closeModal}>{t('Continue Configuring SDK')}</Button>
          <Button priority="primary" onClick={handleSetUpLater}>
            {t('Skip Onboarding')}
          </Button>
        </ButtonBar>
      </Footer>
    </Fragment>
  );
};
