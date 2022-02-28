import React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {closeModal, ModalRenderProps} from 'sentry/actionCreators/modal';
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

export default function OverwriteWidgetModal({
  Header,
  Body,
  Footer,
  onConfirm,
  widget,
  iconColor,
}: Props) {
  function handleSubmit() {
    onConfirm();
    closeModal();
  }

  return (
    <React.Fragment>
      <Header>
        <h4>{t('Overwrite Widget')}</h4>
      </Header>
      <Body>
        {MODAL_DESCRIPTION}
        <Card widget={widget} iconColor={iconColor} disableHoverAnimation />
      </Body>
      <Footer>
        <Actions>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button priority="primary" onClick={handleSubmit}>
            {t('Confirm')}
          </Button>
        </Actions>
      </Footer>
    </React.Fragment>
  );
}

export const modalCss = css`
  width: 100%;
  max-width: 700px;
  margin: 70px auto;
`;

const Actions = styled(ButtonBar)`
  gap: ${space(1.5)};
`;
