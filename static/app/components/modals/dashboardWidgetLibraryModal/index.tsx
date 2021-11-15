import * as React from 'react';
import {useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {ModalRenderProps, openAddDashboardWidgetModal} from 'app/actionCreators/modal';
import Tag from 'app/components/tagDeprecated';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import {DashboardDetails, Widget} from 'app/views/dashboardsV2/types';
import {WidgetTemplate} from 'app/views/dashboardsV2/widgetLibrary/data';

import Button from '../../button';
import ButtonBar from '../../buttonBar';

import DashboardWidgetLibraryTab from './libraryTab';

export type DashboardWidgetLibraryModalOptions = {
  organization: Organization;
  dashboard: DashboardDetails;
  initialSelectedWidgets?: WidgetTemplate[];
  customWidget?: Widget;
  onAddWidget: (widgets: Widget[]) => void;
};

export enum TAB {
  Library = 'library',
  Custom = 'custom',
}

type Props = ModalRenderProps &
  DashboardWidgetLibraryModalOptions & {
    selection: GlobalSelection;
  };

function DashboardWidgetLibraryModal({
  Header,
  Body,
  Footer,
  dashboard,
  organization,
  selection,
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
        <h4>{t('Add Widget')}</h4>
      </Header>
      <Body>
        <StyledButtonBar>
          <Button
            barId={TAB.Custom}
            onClick={() => {
              openAddDashboardWidgetModal({
                organization,
                selection,
                dashboard,
                selectedWidgets,
                widget: customWidget,
                fromLibrary: true,
                onAddLibraryWidget: onAddWidget,
              });
            }}
          >
            {t('Custom')}
          </Button>
        </StyledButtonBar>
        <DashboardWidgetLibraryTab
          selectedWidgets={selectedWidgets}
          errored={errored}
          setSelectedWidgets={setSelectedWidgets}
          setErrored={setErrored}
        />
      </Body>
      <Footer>
        <FooterButtonbar gap={1}>
          <Button
            external
            href="https://docs.sentry.io/product/dashboards/custom-dashboards/#widget-builder"
          >
            {t('Read the docs')}
          </Button>
          <div>
            <SelectedBadge data-test-id="selected-badge">
              {`${selectedWidgets.length} Selected`}
            </SelectedBadge>
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
              {t('Confirm')}
            </Button>
          </div>
        </FooterButtonbar>
      </Footer>
    </React.Fragment>
  );
}

export const modalCss = css`
  width: 100%;
  max-width: 700px;
  margin: 70px auto;
`;

const StyledButtonBar = styled(ButtonBar)`
  margin-bottom: ${space(1)};
`;

const FooterButtonbar = styled(ButtonBar)`
  justify-content: space-between;
  width: 100%;
`;

const SelectedBadge = styled(Tag)`
  padding: 3px ${space(0.75)};
  display: inline-flex;
  align-items: center;
  margin-left: ${space(1)};
  margin-right: ${space(1)};
  top: -1px;
`;

export default withGlobalSelection(DashboardWidgetLibraryModal);
