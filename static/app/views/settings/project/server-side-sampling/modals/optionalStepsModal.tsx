import {Fragment} from 'react';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {t, tct} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import {SERVER_SIDE_DOC_LINK} from '../utils';

import {FooterActions, Stepper} from './uniformRateModal';

type Props = ModalRenderProps & {
  organization: Organization;
  project?: Project;
};

export function OptionalStepsModal({Header, Body, Footer, closeModal}: Props) {
  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Optional Steps')}</h4>
      </Header>
      <Body>
        <TextBlock>
          {tct(
            'Sampling both client and server-side can create the situation where you’re [notReceivingEnoughAcceptedTrans:not receiving enough accepted transactions] because server-side sampling apply on top of any sampling configured within your client’s [sentryInit:Sentry.init()].',
            {
              notReceivingEnoughAcceptedTrans: <strong />,
              sentryInit: <strong />,
            }
          )}
        </TextBlock>
        <TextBlock>
          {t('To avoid any headaches in the future we recommend the following steps')}
        </TextBlock>
        <List>
          <ListItem />
        </List>
      </Body>
      <Footer>
        <FooterActions>
          <Button href={SERVER_SIDE_DOC_LINK} external>
            {t('Read Docs')}
          </Button>

          <ButtonBar gap={1}>
            <Stepper>{t('Step 2 of 2')}</Stepper>
            <Button onClick={closeModal}>{t('Cancel')}</Button>
            <Button priority="primary">{t('Done')}</Button>
          </ButtonBar>
        </FooterActions>
      </Footer>
    </Fragment>
  );
}
