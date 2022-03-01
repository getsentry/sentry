import React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Card} from 'sentry/views/dashboardsV2/widgetBuilder/widgetLibrary/card';
import {WidgetTemplate} from 'sentry/views/dashboardsV2/widgetLibrary/data';

export type OverwriteWidgetModalProps = {
  iconColor: string;
  onConfirm: () => void;
  widget: WidgetTemplate;
};

type Props = ModalRenderProps & OverwriteWidgetModalProps;

const MODAL_DESCRIPTION = t(
  "You've already started building this widget and will lose unsaved changes. Are you sure you want to overwrite this widget with the template values?"
);

function OverwriteWidgetModal({
  Header,
  Body,
  Footer,
  closeModal,
  onConfirm,
  widget,
  iconColor,
}: Props) {
  function handleConfirm() {
    onConfirm();
    closeModal();
  }

  return (
    <React.Fragment>
      <Header closeButton>
        <h4>{t('Overwrite Widget')}</h4>
      </Header>
      <Body>
        {MODAL_DESCRIPTION}
        <CardWrapper>
          <Card widget={widget} iconColor={iconColor} />
        </CardWrapper>
      </Body>
      <Footer>
        <ButtonBar gap={1.5}>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button priority="primary" onClick={handleConfirm}>
            {t('Confirm')}
          </Button>
        </ButtonBar>
      </Footer>
    </React.Fragment>
  );
}

export default OverwriteWidgetModal;

export const modalCss = css`
  width: 100%;
  max-width: 700px;
  margin: 70px auto;
`;

const CardWrapper = styled('div')`
  padding: ${space(3)} 0;
`;
