import {Fragment, useCallback} from 'react';
import {RouteComponentProps} from 'react-router';
import {Location} from 'history';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {t} from 'sentry/locale';

type Props = {
  nextLocation: Location;
  router: RouteComponentProps<{}, {}>['router'];
} & ModalRenderProps;

export function ChangeRouteModal({
  Header,
  Body,
  Footer,
  router,
  nextLocation,
  closeModal,
}: Props) {
  const handleSetUpLater = useCallback(() => {
    closeModal();

    router.push({
      ...nextLocation,
      query: nextLocation.query,
    });
  }, [router, nextLocation, closeModal]);

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
}
