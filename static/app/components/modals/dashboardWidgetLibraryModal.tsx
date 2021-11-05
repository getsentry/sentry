import * as React from 'react';
import {css} from '@emotion/react';

import {ModalRenderProps} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import {DashboardDetails} from 'app/views/dashboardsV2/types';

export type DashboardWidgetLibraryModalOptions = {
  organization: Organization;
  dashboard: DashboardDetails;
};

type Props = ModalRenderProps & DashboardWidgetLibraryModalOptions;

function DashboardWidgetLibraryModal({Header, Body}: Props) {
  return (
    <React.Fragment>
      <Header closeButton>
        <h4>{t('Add Widget')}</h4>
      </Header>
      <Body />
    </React.Fragment>
  );
}

export const modalCss = css`
  width: 100%;
  max-width: 700px;
  margin: 70px auto;
`;

export default DashboardWidgetLibraryModal;
