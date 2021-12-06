import * as React from 'react';
import {useState} from 'react';
import {css} from '@emotion/react';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {DashboardDetails, Widget} from 'sentry/views/dashboardsV2/types';
import {WidgetTemplate} from 'sentry/views/dashboardsV2/widgetLibrary/data';

import Button from '../../button';
import ButtonBar from '../../buttonBar';

import DashboardWidgetLibraryTab from './libraryTab';
import {TAB, TabsButtonBar} from './tabsButtonBar';

export type DashboardWidgetLibraryModalOptions = {
  organization: Organization;
  dashboard: DashboardDetails;
  initialSelectedWidgets?: WidgetTemplate[];
  customWidget?: Widget;
  onAddWidget: (widgets: Widget[]) => void;
};

type Props = ModalRenderProps & DashboardWidgetLibraryModalOptions;

function DashboardWidgetLibraryModal({
  Header,
  Body,
  Footer,
  dashboard,
  organization,
  customWidget,
  initialSelectedWidgets,
  closeModal,
  onAddWidget,
}: Props) {
  const [selectedWidgets, setSelectedWidgets] = useState<WidgetTemplate[]>(
    initialSelectedWidgets ? initialSelectedWidgets : []
  );
  const [errored, setErrored] = useState(false);

  function handleSubmit() {
    onAddWidget([...dashboard.widgets, ...selectedWidgets]);
    closeModal();
  }

  return (
    <React.Fragment>
      <Header closeButton>
        <h4>{t('Add Widget(s)')}</h4>
      </Header>
      <Body>
        <TabsButtonBar
          activeTab={TAB.Library}
          organization={organization}
          dashboard={dashboard}
          selectedWidgets={selectedWidgets}
          customWidget={customWidget}
          onAddWidget={onAddWidget}
        />
        <DashboardWidgetLibraryTab
          selectedWidgets={selectedWidgets}
          errored={errored}
          setSelectedWidgets={setSelectedWidgets}
          setErrored={setErrored}
        />
      </Body>
      <Footer>
        <ButtonBar gap={1}>
          <Button
            external
            href="https://docs.sentry.io/product/dashboards/custom-dashboards/#widget-builder"
          >
            {t('Read the docs')}
          </Button>
          <Button
            data-test-id="confirm-widgets"
            priority="primary"
            type="button"
            onClick={(event: React.FormEvent) => {
              event.preventDefault();
              if (!!!selectedWidgets.length) {
                setErrored(true);
                return;
              }
              handleSubmit();
            }}
          >
            {t('Save')}
          </Button>
        </ButtonBar>
      </Footer>
    </React.Fragment>
  );
}

export const modalCss = css`
  width: 100%;
  max-width: 700px;
  margin: 70px auto;
`;

export default DashboardWidgetLibraryModal;
